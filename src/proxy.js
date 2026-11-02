import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { decryptSession } from "@/lib/session-token";
import {
  isValidLinkCode,
  SHOP_ATTRIBUTION_COOKIE,
  SHOP_ATTRIBUTION_DAYS,
  SHOP_LINK_PARAM,
} from "@/lib/shop-shared";

// Centralised route gate. Runs before every page request and redirects users who
// manually type a URL they are not allowed to be on — in BOTH directions:
//
//   • signed out  → /admin/*, /dashboard/*              ⇒ sent to /login
//   • customer    → /admin/*                            ⇒ sent to /
//   • signed in   → /login, /register, /forgot-password ⇒ sent to /admin or /dashboard
//
// It reads decryptSession from lib/session-token.js rather than lib/auth.js:
// that module is deliberately free of Prisma and next/headers, so this file —
// which runs on EVERY page request, prefetches included — does not drag Prisma
// Client into the request path. lib/auth.js re-exports the same function.
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

// --- Staging gate -----------------------------------------------------------
//
// Set STAGING_PASSWORD on the staging deploy and every PAGE request has to get
// past a password first. Unset (production) the whole thing compiles away to a
// single falsy check.
//
// The gate lives here rather than in Vercel's own Deployment Protection for one
// decisive reason: Vercel's protection answers 401 to EVERY path, /api included,
// which would silently break the Stripe webhook — the store would take a payment
// and never mark the order paid. The matcher at the bottom of this file already
// excludes /api, so a webhook still arrives while every human-visible page stays
// shut. (Those API routes enforce their own auth, and the webhook verifies the
// Stripe signature, so leaving them reachable costs nothing.)
const STAGING_PASSWORD = process.env.STAGING_PASSWORD || "";
const STAGING_COOKIE = "staging-auth";

// The cookie carries a digest, never the password itself, so nobody picks the
// value out of devtools or a screen-share and hands it on.
function stagingDigest(value) {
  return createHash("sha256").update(value).digest("hex");
}

const STAGING_TOKEN = STAGING_PASSWORD ? stagingDigest(STAGING_PASSWORD) : "";

// Deliberately plain: this page is the first thing the client sees, so it should
// look deliberate rather than broken. No external anything — the site's CSP
// allows inline styles but blocks every third-party host.
const STAGING_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Private preview</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#faf8f4;color:#2c2c2c">
<form method="get" style="width:100%;max-width:22rem;padding:2rem;text-align:center">
<h1 style="font-size:1.25rem;font-weight:600;margin:0 0 .5rem">Private preview</h1>
<p style="font-size:.875rem;color:#6b6b6b;margin:0 0 1.5rem">This site is not public yet. Enter the access password to continue.</p>
<input type="password" name="key" autofocus required aria-label="Access password"
 style="width:100%;box-sizing:border-box;padding:.7rem .9rem;font-size:1rem;border:1px solid #d8d2c6;border-radius:.5rem;background:#fff">
<button type="submit"
 style="width:100%;margin-top:.75rem;padding:.7rem;font-size:1rem;font-weight:600;color:#fff;background:#2c6e49;border:0;border-radius:.5rem;cursor:pointer">View site</button>
</form></body></html>`;

/**
 * Returns a response when the request must be stopped at the gate, or null to
 * let it carry on into the normal auth checks below.
 */
function stagingGate(request) {
  if (!STAGING_PASSWORD) return null;
  if (request.cookies.get(STAGING_COOKIE)?.value === STAGING_TOKEN) return null;

  // ?key=… is what makes a single clickable link enough to hand to the client.
  // It is also what the password form submits (method="get"), so both routes in
  // land here. Comparing digests rather than the raw strings keeps the password
  // out of this comparison entirely.
  const key = request.nextUrl.searchParams.get("key");
  if (key && stagingDigest(key) === STAGING_TOKEN) {
    // Swap the param for a cookie and strip it from the URL straight away, so
    // the password stops travelling in browser history, server logs, and any
    // Referer header the page later sends.
    const url = new URL(request.nextUrl);
    url.searchParams.delete("key");
    const response = NextResponse.redirect(url);
    response.cookies.set(STAGING_COOKIE, STAGING_TOKEN, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days — long enough to outlast a review
    });
    return response;
  }

  // 401 rather than 200 so a crawler that somehow reaches the URL records
  // "no access", not "a page whose content is a password box".
  return new NextResponse(STAGING_PAGE, {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

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

  // Outermost perimeter, ahead of everything else: on a staging deploy nobody
  // sees any page at all — not even /maintenance — until they are past this.
  const gated = stagingGate(request);
  if (gated) return gated;

  if (MAINTENANCE_MODE && pathname !== "/maintenance") {
    return NextResponse.rewrite(new URL("/maintenance", request.nextUrl));
  }

  // A shop link (any page + ?via=code). Swap the parameter for a cookie and clean
  // the URL straight away, so the shopper does not carry the code around or re-share
  // it, and the page they land on is the page the advert promised. The last link
  // clicked wins.
  //
  // The code is not looked up here, and that is on purpose as well as for speed:
  // a real code and a made-up one get identical treatment, so this cannot be used
  // to discover which shops exist. Checkout decides whether it means anything.
  const linkCode = request.nextUrl.searchParams.get(SHOP_LINK_PARAM);
  if (linkCode !== null) {
    const url = new URL(request.nextUrl);
    url.searchParams.delete(SHOP_LINK_PARAM);
    const response = NextResponse.redirect(url);
    if (isValidLinkCode(linkCode)) {
      response.cookies.set(SHOP_ATTRIBUTION_COOKIE, linkCode, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * SHOP_ATTRIBUTION_DAYS,
      });
    }
    return response;
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
