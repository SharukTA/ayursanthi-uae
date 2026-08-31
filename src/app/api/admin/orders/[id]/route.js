import { prisma } from "@/lib/prisma";
import { jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";
import { cancelOrder } from "@/lib/order-actions";

export const runtime = "nodejs";

// Cancel an order on the store's behalf. This is the *only* write an admin makes
// to an order's status.
//
// Fulfilment is not this store's to report. Payment clearing is what confirms an
// order (see confirmPaidOrder in lib/order-payment.js), the dispatch email hands
// the parcel to an outside courier desk, and from there the AWB number at the
// courier is the record of where it is. An admin re-typing that journey into a
// dropdown would only produce a second, slower, less accurate copy of it — so
// the ladder is gone and PROCESSING/SHIPPED/OUT_FOR_DELIVERY/DELIVERED are no
// longer reachable. Orders already carrying those values keep them.
//
// Cancelling is not a plain status write: it has to put stock back and refund
// the money, so it goes through the same cancelOrder() the customer's own cancel
// button uses.
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // The route used to take any status. Anything still asking for one of the
    // old rungs is refused outright rather than quietly cancelled — a stale
    // client sending "SHIPPED" must not end up refunding a customer.
    const status = String(body.status || "CANCELLED").toUpperCase();
    if (status !== "CANCELLED") {
      return jsonError(
        "Fulfillment status is no longer set here — the courier owns it once the order is paid. " +
          "The only status an admin can write is CANCELLED.",
        400
      );
    }

    const result = await cancelOrder({
      orderId: id,
      actor: "ADMIN",
      reason: String(body.reason || "").trim() || "Cancelled by the store",
    });

    if (result.status === "not_found") {
      return jsonError("Order not found.", 404);
    }
    if (result.status !== "cancelled") {
      // Same `code` contract as the customer route: the admin sheet uses it to
      // close itself and reload the table, because an expired order has lost its
      // button and leaving the sheet open only invites a second futile submit.
      return jsonError(result.message || "Could not cancel this order.", 409, {
        code: result.expired ? "cancel_window_closed" : undefined,
      });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: true,
      },
    });

    return Response.json({ order });
  } catch (err) {
    return prismaErrorResponse(err, "Unable to cancel this order.");
  }
}
