import { NextResponse } from "next/server";
import { decryptSession } from "@/lib/auth";

// Centralised route gate. Runs before every page request and redirects users who
// manually type a URL they are not allowed to be on — in BOTH directions:
//
//   • signed out  → /admin/*, /dashboard/*              ⇒ sent to /login
//   • customer    → /admin/*                            ⇒ sent to /
//   • signed in   → /login, /register, /forgot-password ⇒ sent to /admin or /dashboard
//
// NOTE (Next.js 16): this file is `proxy.js`, not `middleware.js` — Middleware
// was renamed to Proxy in v16. It runs on the Node.js runtime by default, so
// `node:crypto` inside decryptSession works here.
//
// This is an OPTIMISTIC check, exactly as the Next.js auth guide prescribes: it
// only reads and decrypts the session cookie and never touches the database,
// because it runs on every request including prefetches. It is a redirect layer,
// not the authorisation boundary — the real enforcement lives in
// `app/admin/layout.js` (which re-checks the role against the database) and in
// every `/api/**` route via `requireAdmin()` / `getSession()`.

// Site-wide kill switch. Set MAINTENANCE_MODE=true (env var, not code) to send
// every page request to /maintenance while leaving /api untouched (matcher
// below already skips it) so webhooks/cron keep firing. Checked first and
// returns early so it can't be fought by the auth redirects further down.
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === "true";

// Signed-out users are redirected away from these.
//
// /checkout is deliberately NOT here. A guest who has picked a product is the
// worst possible person to bounce to a login page, so checkout hosts its own
// inline account step instead (see app/checkout/page.js) and a visitor is
// allowed to reach it signed out. Nothing is weakened by that: POST /api/orders
// still refuses an anonymous request, which is where the boundary actually is.
const PROTECTED_PREFIXES = ["/dashboard"];

// Additionally require role === "ADMIN".
const ADMIN_PREFIXES = ["/admin"];

// Signed-in users have no business here; they get bounced to their home area.
const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password"];

function matches(pathname, prefixes) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

// Where a signed-in user belongs when they land somewhere they shouldn't be.
function homeFor(session) {
  return session.role === "ADMIN" ? "/admin" : "/dashboard";
}

export default function proxy(request) {
  const { pathname } = request.nextUrl;

  if (MAINTENANCE_MODE && pathname !== "/maintenance") {
    return NextResponse.rewrite(new URL("/maintenance", request.nextUrl));
  }

  // decryptSession returns null for a missing, tampered, or expired token, so an
  // invalid cookie is treated exactly like being signed out.
  const token = request.cookies.get("session")?.value;
  const session = token ? decryptSession(token) : null;

  const isAdminRoute = matches(pathname, ADMIN_PREFIXES);
  const isProtectedRoute = isAdminRoute || matches(pathname, PROTECTED_PREFIXES);

  if (isProtectedRoute && !session) {
    // Preserve the destination so login can return the user to it.
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Signed in, but a customer trying to reach the admin area.
  if (isAdminRoute && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  // The reverse direction: already signed in, so the auth pages are pointless.
  if (session && GUEST_ONLY_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL(homeFor(session), request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Skip /api (those routes answer with 401/403 JSON — redirecting them would
  // break client fetches), Next internals, and static asset requests.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|svg|webp|mp4|ico|webmanifest)$).*)",
  ],
};
