import { getSession } from "@/lib/auth";
import {
  addToUserCart,
  getUserCart,
  removeFromUserCart,
  setAllCartLinesSelected,
  setUserCartLine,
  clearUserCart,
} from "@/lib/cart";

export const runtime = "nodejs";

// Every response carries the full, freshly-read cart so the client never has to
// guess what the server did — it just renders what came back.
async function cartResponse(userId, extra = {}) {
  return Response.json({ items: await getUserCart(userId), ...extra });
}

/**
 * Resolves the caller into one of three cases:
 *
 *   guest    — no session. Answered with 401 so the client falls back to the
 *              browser cart. This is a normal, expected state, not an error.
 *   admin    — signed in but cannot shop (mirrors the block in ProductActions
 *              and in /api/orders). Reads return an empty cart; writes are 403.
 *   customer — the real thing.
 */
async function resolveShopper() {
  const session = await getSession();
  if (!session) {
    return {
      response: Response.json({ message: "Not signed in." }, { status: 401 }),
    };
  }
  if (session.role === "ADMIN") return { admin: true };
  return { userId: session.userId };
}

// Writes are customer-only; an admin gets a plain 403.
function adminBlocked() {
  return Response.json(
    { message: "Administrator accounts cannot add products to a cart." },
    { status: 403 }
  );
}

// GET /api/cart — the signed-in shopper's cart.
export async function GET() {
  try {
    const { response, admin, userId } = await resolveShopper();
    if (response) return response;
    if (admin) return Response.json({ items: [], readOnly: true });
    return await cartResponse(userId);
  } catch (error) {
    console.error("Cart read failed:", error);
    return Response.json({ message: "Could not load your cart." }, { status: 500 });
  }
}

// POST /api/cart  { productId, quantity }
// Adds to the cart, stacking onto any line the product already has.
export async function POST(request) {
  try {
    const { response, admin, userId } = await resolveShopper();
    if (response) return response;
    if (admin) return adminBlocked();

    const body = await request.json();
    const result = await addToUserCart(userId, body?.productId, body?.quantity);

    if (result.error) {
      return Response.json({ message: result.error }, { status: 400 });
    }

    return await cartResponse(userId, {
      // Set when stock (or the 30-unit line cap) trimmed the request, so the
      // client can say so instead of silently showing a smaller number.
      capped: result.capped || false,
      quantity: result.quantity,
    });
  } catch (error) {
    console.error("Add to cart failed:", error);
    return Response.json({ message: "Could not update your cart." }, { status: 500 });
  }
}

// PATCH /api/cart — two shapes:
//   { productId, quantity }  set a line's quantity (0 or less removes it)
//   { productId, selected }  tick/untick one line
//   { selectAll: boolean }   tick/untick every line ("Select all items")
export async function PATCH(request) {
  try {
    const { response, admin, userId } = await resolveShopper();
    if (response) return response;
    if (admin) return adminBlocked();

    const body = await request.json();

    if (typeof body?.selectAll === "boolean") {
      await setAllCartLinesSelected(userId, body.selectAll);
      return await cartResponse(userId);
    }

    const result = await setUserCartLine(userId, body?.productId, {
      quantity: body?.quantity,
      selected: body?.selected,
    });

    if (result.error) {
      return Response.json({ message: result.error }, { status: 400 });
    }

    return await cartResponse(userId, { capped: result.capped || false });
  } catch (error) {
    console.error("Cart update failed:", error);
    return Response.json({ message: "Could not update your cart." }, { status: 500 });
  }
}

// DELETE /api/cart?productId=x   remove one line
// DELETE /api/cart?all=1         empty the cart
export async function DELETE(request) {
  try {
    const { response, admin, userId } = await resolveShopper();
    if (response) return response;
    if (admin) return adminBlocked();

    const params = request.nextUrl.searchParams;

    if (params.get("all") === "1") {
      await clearUserCart(userId);
    } else {
      const productId = params.get("productId");
      if (!productId) {
        return Response.json({ message: "No product specified." }, { status: 400 });
      }
      await removeFromUserCart(userId, [productId]);
    }

    return await cartResponse(userId);
  } catch (error) {
    console.error("Cart removal failed:", error);
    return Response.json({ message: "Could not update your cart." }, { status: 500 });
  }
}
