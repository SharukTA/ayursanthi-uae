import { prisma } from "@/lib/prisma";
import { jsonError, ORDER_STATUSES, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";
import { cancelOrder } from "@/lib/order-actions";
import { canTransitionOrderStatus } from "@/lib/returns";

export const runtime = "nodejs";

// Admin updates the fulfillment status of an order (PENDING → … → DELIVERED, or
// CANCELLED). The new status is immediately visible to the customer on their
// dashboard orders page, which reads Order.status.
//
// Payment follows fulfillment, because Cash on Delivery is the only payment
// method: the courier collects the cash at the door, so DELIVERED *is* the
// moment the order becomes paid. Anything else leaves paymentStatus untouched.
//
// CANCELLED is not a plain status write: it has to put stock back and settle (or
// refund) the money, so it goes through the same cancelOrder() the customer's
// own cancel button uses.
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const status = String(body.status || "").toUpperCase();

    if (!ORDER_STATUSES.includes(status)) {
      return jsonError(
        `Invalid order status. Must be one of: ${ORDER_STATUSES.join(", ")}.`
      );
    }

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      return jsonError("Order not found.", 404);
    }

    // Forward-only ladder: a status can only advance, never step back, and a
    // DELIVERED or CANCELLED order is frozen. The admin dropdown greys out the
    // illegal moves, but this is the check that actually enforces it — a
    // hand-crafted PATCH cannot walk CONFIRMED back to PENDING or reopen a
    // cancelled order.
    if (!canTransitionOrderStatus(existing.status, status)) {
      return jsonError(
        `An order that is ${existing.status} cannot be changed to ${status}.`,
        409
      );
    }

    if (status === "CANCELLED") {
      const result = await cancelOrder({
        orderId: id,
        actor: "ADMIN",
        reason: String(body.reason || "").trim() || "Cancelled by the store",
      });

      if (result.status !== "cancelled") {
        return jsonError(result.message || "Could not cancel this order.", 409);
      }

      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          items: true,
        },
      });

      return Response.json({ order });
    }

    // Only ever move payment *off* PENDING. An order that already settled keeps
    // its recorded outcome — a refunded order must not be rewritten to PAID by a
    // later status change.
    const paymentStatus =
      existing.paymentStatus === "PENDING" && status === "DELIVERED" ? "PAID" : null;

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status,
          ...(paymentStatus ? { paymentStatus } : {}),
          // Stamped once: this is what starts the customer's return window.
          ...(status === "DELIVERED" && !existing.deliveredAt ? { deliveredAt: new Date() } : {}),
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          items: true,
        },
      });

      // Keep the Payment ledger row in step with the order it belongs to.
      if (paymentStatus) {
        await tx.payment.updateMany({
          where: { orderId: id, status: "PENDING" },
          data: { status: paymentStatus },
        });
      }

      return updated;
    });

    return Response.json({ order });
  } catch (err) {
    return prismaErrorResponse(err, "Unable to update order status.");
  }
}
