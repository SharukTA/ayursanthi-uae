import { getSession } from "@/lib/auth";
import { placeCodOrder } from "@/lib/checkout";
import { sendNewOrderAdminEmail, sendOrderPlacedEmail } from "@/lib/email-orders";
import { queueEmail } from "@/lib/email-queue";
import { validateShippingAddress } from "@/lib/address";

export const runtime = "nodejs";

/**
 * Places an order. Payment is Cash on Delivery only — there is no gateway step,
 * so this single call validates the cart + address and creates the order.
 * Amounts are always recomputed server-side in lib/checkout.js.
 */
export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json(
        { message: "Unauthorized. Please log in to complete your checkout." },
        { status: 401 }
      );
    }

    if (session.role === "ADMIN") {
      return Response.json(
        { message: "Administrator accounts cannot book products." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { cart, shippingAddress, cartSource } = body;

    // Which list the shopper checked out. Only "account" — the saved cart —
    // gets its purchased lines removed; "guest" (a browser cart built while
    // signed out) and "buynow" leave the saved cart exactly as it was. Nothing
    // security-sensitive rides on this: the worst a bad value can do is leave a
    // stale line in the shopper's own cart, so an unknown value falls back to
    // the historical behaviour.

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return Response.json({ message: "Your cart is empty." }, { status: 400 });
    }

    // Re-validated server-side against the very rules the checkout form used,
    // so a hand-crafted request can't store an address nobody can deliver to —
    // no contact number the courier can dial, no building, no emirate. There is
    // no postal code in the shape at all: the UAE has no postal-code system.
    // See lib/address.js.
    const addressError = validateShippingAddress(shippingAddress);
    if (addressError) {
      return Response.json({ message: addressError }, { status: 400 });
    }

    const result = await placeCodOrder({
      userId: session.userId,
      cart: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      shippingAddress,
      clearAccountCart: cartSource !== "guest" && cartSource !== "buynow",
    });

    if (result.status !== "created") {
      return Response.json(
        { message: result.message || "Could not place your order." },
        { status: 400 }
      );
    }

    // Hooked here rather than inside placeCodOrder() because this route is its
    // only caller — checkout.js stays a pure pricing/persistence function.
    queueEmail(() => sendOrderPlacedEmail(result.order.id));
    queueEmail(() => sendNewOrderAdminEmail(result.order.id));

    return Response.json({
      success: true,
      message: "Order placed. Pay cash when your order is delivered.",
      orderNumber: result.order.orderNumber,
      orderId: result.order.id,
    });
  } catch (error) {
    console.error("Order placement failed:", error);
    return Response.json(
      { message: error.message || "Failed to place your order." },
      { status: 400 }
    );
  }
}
