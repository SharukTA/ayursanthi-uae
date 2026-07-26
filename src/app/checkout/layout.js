import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Checkout requires a signed-in user. This isn't only a UI preference: the
// POST /api/orders handler rejects an anonymous request with 401, so a guest
// filling in the checkout form could never actually place the order. Guarding
// the page server-side turns that dead end into a login prompt.
export default async function CheckoutLayout({ children }) {
  const session = await getSession();

  if (!session) {
    redirect("/login?next=/checkout");
  }

  return children;
}
