import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// The reverse guard: an already signed-in user has no reason to be on the login,
// register or forgot-password pages, so they are sent to their own home area.
//
// `proxy.js` handles this too, but repeating it here means the rule survives
// even if a route is later excluded from the proxy matcher — and it keeps the
// server, not the browser, in charge of the decision.
export default async function AuthLayout({ children }) {
  const session = await getSession();

  if (session) {
    redirect(session.role === "ADMIN" ? "/admin" : "/dashboard");
  }

  return children;
}
