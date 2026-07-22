import { prisma } from "@/lib/prisma";
import { jsonError, ORDER_STATUSES, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

// Admin updates the fulfillment status of an order (PENDING → … → DELIVERED, or
// CANCELLED). The new status is immediately visible to the customer on their
// dashboard orders page, which reads Order.status.
//
// Payment follows fulfillment, because Cash on Delivery is the only payment
// method: the courier collects the cash at the door, so DELIVERED *is* the
// moment the order becomes paid. CANCELLED means the cash was never collected.
// Anything else leaves paymentStatus untouched.
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

    // Only ever move payment *off* PENDING. An order that already settled keeps
    // its recorded outcome — cancelling a paid order is a refund, not a failure,
    // and must not be silently rewritten to FAILED here.
    let paymentStatus = null;
    if (existing.paymentStatus === "PENDING") {
      if (status === "DELIVERED") paymentStatus = "PAID";
      else if (status === "CANCELLED") paymentStatus = "FAILED";
    }

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: { status, ...(paymentStatus ? { paymentStatus } : {}) },
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
