// Checkout is open to signed-out visitors on purpose.
//
// It used to redirect guests to /login, which threw away shoppers at the exact
// moment they had already chosen what to buy. The page now carries its own
// account step: a guest registers or signs in inline and carries straight on to
// placing the order, so the purchase never leaves this screen.
//
// Nothing about the security model changed. The authorisation boundary was never
// this layout — it is POST /api/orders, which still answers 401 to an anonymous
// request and 403 to an admin, and lib/checkout.js which recomputes every amount
// from the database. This file stays as the place that documents why the route
// is ungated.
export default function CheckoutLayout({ children }) {
  return children;
}
