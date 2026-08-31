import { getSession } from "@/lib/auth";
import { cancelOrder } from "@/lib/order-actions";
import { CANCEL_REASONS, cancelReasonLabel } from "@/lib/order-policy";
import { formatMoney } from "@/lib/currency";

export const runtime = "nodejs";

const STATUS_CODES = {
  not_found: 404,
  forbidden: 403,
  not_allowed: 409,
  // The order is fine and the request was valid — Stripe would not give the
  // money back. Nothing was changed, so retrying is the right response.
  refund_failed: 502,
};

/**
 * Customer cancels their own order.
 *
 * Only orders that have not been handed to the courier can be cancelled — the
 * window shuts a fixed number of hours after the order was placed, set by the
 * admin in /admin/settings and enforced by canCancelOrder(). There is no return
 * or replacement path afterwards: cancelling inside that window is the only way
 * out of an order.
 *
 * Cancelling restores stock and settles the payment side: an order that was
 * never paid for is simply marked FAILED, while one already paid for is
 * refunded in full, back to the card through Stripe.
 */
export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Please log in to manage your orders." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const reasonValue = String(body.reason || "").trim();
    if (!CANCEL_REASONS.some((option) => option.value === reasonValue)) {
      return Response.json(
        { message: "Please choose why you are cancelling this order." },
        { status: 400 }
      );
    }

    // Stored ready to display: the picked reason, plus the customer's own words.
    const note = String(body.comment || "").trim().slice(0, 500);
    const reason = note ? `${cancelReasonLabel(reasonValue)} — ${note}` : cancelReasonLabel(reasonValue);

    const result = await cancelOrder({
      orderId: id,
      userId: session.userId,
      actor: "CUSTOMER",
      reason,
    });

    if (result.status !== "cancelled") {
      return Response.json(
        {
          message: result.message || "This order can no longer be cancelled.",
          // Machine-readable so the cancellation sheet can tell "the window shut
          // while you were filling this in" — where the right move is to close
          // the sheet and refresh the list, because the button is gone — from a
          // refund that merely needs retrying.
          code: result.expired ? "cancel_window_closed" : undefined,
        },
        { status: STATUS_CODES[result.status] ?? 400 }
      );
    }

    const refunded = Number(result.order.refundedTotal) > 0;

    return Response.json({
      success: true,
      message: refunded
        ? `Order cancelled. ${formatMoney(result.order.refundedTotal)} will be refunded to you.`
        : "Order cancelled. Nothing was charged, so there is nothing to refund.",
      order: result.order,
    });
  } catch (error) {
    console.error("Order cancellation failed:", error);
    return Response.json({ message: "Could not cancel this order." }, { status: 500 });
  }
}
