import { getSession } from "@/lib/auth";
import { getUserCart, mergeGuestCart } from "@/lib/cart";

export const runtime = "nodejs";

// A browser cart is small by nature; this only bounds a hand-crafted request.
const MAX_MERGE_ITEMS = 100;

/**
 * POST /api/cart/merge  { items: [{ productId, quantity }] }
 *
 * Folds the cart a visitor built while signed out into the account they have
 * just signed in to, then answers with the merged cart. Quantities are added per
 * product and clamped to live stock — see mergeGuestCart in lib/cart.js.
 *
 * The client clears its browser cart once this returns, which is also what stops
 * one person's cart leaking into the next account signed in on a shared
 * computer. That makes the 403 below deliberate rather than silent: an admin
 * cannot shop, so their sign-in still consumes (and discards) the browser cart.
 */
export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ message: "Not signed in." }, { status: 401 });
    }
    if (session.role === "ADMIN") {
      return Response.json(
        { message: "Administrator accounts cannot add products to a cart." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const items = Array.isArray(body?.items) ? body.items.slice(0, MAX_MERGE_ITEMS) : [];

    await mergeGuestCart(session.userId, items);

    return Response.json({ items: await getUserCart(session.userId) });
  } catch (error) {
    console.error("Cart merge failed:", error);
    return Response.json({ message: "Could not merge your cart." }, { status: 500 });
  }
}
