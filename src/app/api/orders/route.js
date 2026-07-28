import { getSession } from "@/lib/auth";
import { placeCodOrder } from "@/lib/checkout";
import { sendNewOrderAdminEmail, sendOrderPlacedEmail } from "@/lib/email-orders";
import { queueEmail } from "@/lib/email-queue";
import { validatePhone } from "@/lib/validation";
import { countryUsesPostalCode } from "@/lib/geo/postal";

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
    const { cart, shippingAddress } = body;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return Response.json({ message: "Your cart is empty." }, { status: 400 });
    }

    // The postal code is only required where the country actually has one — the
    // UAE has no postal-code system, so demanding one here would reject every
    // genuine local address. Mirrors the checkout form; see lib/geo/postal.js.
    const postalRequired = countryUsesPostalCode(shippingAddress?.countryCode);

    if (
      !shippingAddress ||
      !shippingAddress.fullName ||
      !shippingAddress.phone ||
      !shippingAddress.line1 ||
      !shippingAddress.city ||
      !shippingAddress.state ||
      (postalRequired && !shippingAddress.postalCode) ||
      !shippingAddress.country
    ) {
      return Response.json(
        { message: "Please provide all required shipping address fields." },
        { status: 400 }
      );
    }

    // Re-validate the phone server-side so a hand-crafted request can't store an
    // unusable delivery contact number — the courier needs it to collect cash.
    const phoneError = validatePhone(shippingAddress.phone, { required: true });
    if (phoneError) {
      return Response.json({ message: phoneError }, { status: 400 });
    }

    const result = await placeCodOrder({
      userId: session.userId,
      cart: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      shippingAddress,
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
