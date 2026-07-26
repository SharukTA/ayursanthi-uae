import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Authorisation boundary for every /admin/* page.
//
// `proxy.js` already redirects unauthorised users before the request reaches
// here, but that check is optimistic (cookie-only) and the Next.js auth guide is
// explicit that Proxy must not be the sole authorisation solution. This layout
// is the real gate: it runs on the server for every admin page, so no admin page
// can be rendered without passing it.
//
// It also re-reads the role from the DATABASE rather than trusting the role
// baked into the session cookie at login. Without this, demoting an admin would
// have no effect until their 7-day cookie expired.
//
// Rendered as a transparent pass-through — each admin page brings its own
// SiteHeader / SiteFooter chrome.
export default async function AdminLayout({ children }) {
  const session = await getSession();

  if (!session) {
    redirect("/login?next=/admin");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  // Covers a deleted account and a demoted admin, not just a missing session.
  if (user?.role !== "ADMIN") {
    redirect("/");
  }

  return children;
}
