import { prisma } from "@/lib/prisma";
import { jsonError, ORDER_STATUSES, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";
import { sendOrderStatusEmail } from "@/lib/email-orders";
import { queueEmail } from "@/lib/email-queue";
import { cancelOrder } from "@/lib/order-actions";
import { canTransitionOrderStatus } from "@/lib/order-policy";

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

    // Courier details, sent alongside the SHIPPED transition. Absent keys leave
    // the stored values untouched; an explicit empty string clears them.
    const tracking = {};
    if (body.trackingNumber !== undefined) {
      tracking.trackingNumber = String(body.trackingNumber).trim().slice(0, 120) || null;
    }
    if (body.courierName !== undefined) {
      tracking.courierName = String(body.courierName).trim().slice(0, 120) || null;
    }

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status,
          ...(paymentStatus ? { paymentStatus } : {}),
          ...tracking,
          // Stamped once, when an admin marks the order delivered.
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

    // Only mail on a real transition. Re-saving the same status is a legitimate
    // no-op (canTransitionOrderStatus allows it) and is exactly what a
    // tracking-number correction sends — the customer must not get a second
    // "your order has shipped" because a typo was fixed.
    //
    // The CANCELLED branch above returns early — its email is sent from inside
    // cancelOrder(), so both the admin and customer cancel paths are covered.
    if (existing.status !== status) {
      queueEmail(() => sendOrderStatusEmail(id, status));
    }

    return Response.json({ order });
  } catch (err) {
    return prismaErrorResponse(err, "Unable to update order status.");
  }
}
