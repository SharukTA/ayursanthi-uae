import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { settleAbandonedCheckout } from "@/lib/order-payment";

export const runtime = "nodejs";

/**
 * Hands back an order the shopper walked away from on Stripe's page.
 *
 * Without this the units sit reserved until the Checkout Session times out —
 * long enough for a low-stock product to look sold out to everyone else, and
 * long enough that the shopper retrying immediately can be told there is not
 * enough stock for the order they just abandoned.
 *
 * The work itself lives in settleAbandonedCheckout(), which expires the Stripe
 * session before releasing anything and confirms the order instead if it turns
 * out to have been paid. This route is only the authenticated doorway to it.
 *
 * Best-effort by design: the webhook's checkout.session.expired event still
 * cleans up anyone who closed the tab rather than clicking back, so a failure
 * here costs time, not correctness — which is why every response is a 200 the
 * browser can safely ignore.
 */
export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ status: "skipped" });
    }

    const { orderId } = await request.json();
    if (!orderId) {
      return Response.json({ status: "skipped" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true },
    });

    // Somebody else's order id is simply not acted on. No 403: the caller is a
    // fire-and-forget fetch with nothing useful to do with the difference.
    if (!order || order.userId !== session.userId) {
      return Response.json({ status: "skipped" });
    }

    const result = await settleAbandonedCheckout({
      orderId: order.id,
      reason: "The shopper cancelled the online payment.",
      source: "cancel_return",
    });

    return Response.json({ status: result.status });
  } catch (error) {
    console.error("Releasing a cancelled Stripe order failed:", error);
    // Still a 200: the webhook is the safety net, and the browser cannot act on
    // this failure anyway.
    return Response.json({ status: "skipped" });
  }
}
