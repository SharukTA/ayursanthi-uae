import { getSession } from "@/lib/auth";
import { cancelOrder } from "@/lib/order-actions";
import { CANCEL_REASONS, cancelReasonLabel } from "@/lib/returns";
import { formatMoney } from "@/lib/currency";

export const runtime = "nodejs";

const STATUS_CODES = {
  not_found: 404,
  forbidden: 403,
  not_allowed: 409,
};

/**
 * Customer cancels their own order.
 *
 * Only orders that have not been handed to the courier can be cancelled — the
 * window closes at SHIPPED, exactly like Amazon. After delivery the customer
 * returns the item instead (POST /api/user/orders/[id]/returns).
 *
 * Cancelling restores stock and settles the payment side: a Cash-on-Delivery
 * order that was never collected is simply marked FAILED, while an order whose
 * cash was already taken is refunded in full.
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
        { message: result.message || "This order can no longer be cancelled." },
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
