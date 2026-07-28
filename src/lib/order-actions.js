import { prisma } from "@/lib/prisma";
import { sendOrderCancelledEmail } from "@/lib/email-orders";
import { queueEmail } from "@/lib/email-queue";
import { canCancelOrder } from "@/lib/order-policy";

/**
 * Write-side of the cancel flow. Every mutation that touches stock or money
 * lives here so the customer route and the admin route go through the same
 * transaction — the policy in lib/order-policy.js decides *whether*, this file
 * decides *what happens*.
 *
 * Money is recorded, never invented: a refund is a Payment row with
 * provider "refund", and Order.refundedTotal is the running sum of those rows.
 * The order only reads REFUNDED once that sum covers its total.
 */

const ORDER_WITH_LINES = {
  items: true,
};

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Records a refund inside an open transaction: one ledger row plus the order's
 * running total. Returns the order's new refunded total.
 */
async function recordRefund(tx, { order, amount, rawResponse }) {
  const refund = round2(amount);
  const alreadyRefunded = Number(order.refundedTotal ?? 0);
  const total = Number(order.total);

  // Never send back more than the order was worth, whatever the caller asks for.
  const capped = round2(Math.min(refund, Math.max(0, total - alreadyRefunded)));
  if (capped <= 0) {
    return { refundedTotal: alreadyRefunded, amount: 0 };
  }

  await tx.payment.create({
    data: {
      orderId: order.id,
      provider: "refund",
      amount: capped,
      status: "REFUNDED",
      rawResponse: { ...rawResponse, amount: capped, issuedAt: new Date().toISOString() },
    },
  });

  const refundedTotal = round2(alreadyRefunded + capped);
  await tx.order.update({
    where: { id: order.id },
    data: {
      refundedTotal,
      // Partially refunded orders stay PAID — only a full refund flips the badge.
      ...(refundedTotal >= total ? { paymentStatus: "REFUNDED" } : {}),
    },
  });

  return { refundedTotal, amount: capped };
}

/**
 * Cancels a whole order.
 *
 * Stock is only given back when the parcel never reached the customer — an admin
 * cancelling an already-delivered order must not conjure units that are sitting
 * in someone's home.
 *
 * Payment, Cash on Delivery being the only method:
 *   - nothing collected yet (PENDING) -> the pending Payment rows go FAILED,
 *     because no cash will ever be taken for this order;
 *   - already collected (PAID) -> the full outstanding value is refunded.
 *
 * @param {object} args
 * @param {string} args.orderId
 * @param {string} [args.userId]  when set, the order must belong to this user
 * @param {"CUSTOMER"|"ADMIN"} args.actor
 * @param {string} [args.reason]
 * @returns {Promise<{status: "cancelled"|"not_found"|"forbidden"|"not_allowed", message?: string, order?: object}>}
 */
export async function cancelOrder({ orderId, userId, actor = "CUSTOMER", reason }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_WITH_LINES,
  });

  if (!order) {
    return { status: "not_found", message: "Order not found." };
  }
  if (userId && order.userId !== userId) {
    return { status: "forbidden", message: "This order does not belong to you." };
  }

  if (actor === "ADMIN") {
    // The seller can pull the plug at any point (out of stock, bad address...),
    // but cancelling twice is still meaningless.
    if (order.status === "CANCELLED") {
      return { status: "not_allowed", message: "This order is already cancelled." };
    }
  } else {
    const verdict = canCancelOrder(order);
    if (!verdict.allowed) {
      return { status: "not_allowed", message: verdict.message };
    }
  }

  const wasDelivered = order.status === "DELIVERED";

  const updated = await prisma.$transaction(async (tx) => {
    if (!wasDelivered) {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: actor === "ADMIN" ? "ADMIN" : "CUSTOMER",
        cancelReason: reason || null,
      },
    });

    if (order.paymentStatus === "PAID") {
      await recordRefund(tx, {
        order,
        amount: Number(order.total) - Number(order.refundedTotal ?? 0),
        rawResponse: {
          kind: "cancellation_refund",
          orderNumber: order.orderNumber,
          cancelledBy: actor,
          reason: reason || null,
        },
      });
    } else if (order.paymentStatus === "PENDING") {
      // Cash on Delivery that will never be delivered: nothing was ever collected.
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED" } });
      await tx.payment.updateMany({
        where: { orderId: order.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
    }

    return tx.order.findUnique({ where: { id: order.id }, include: ORDER_WITH_LINES });
  });

  // Sent from here, not the routes: both the customer's cancel button and the
  // admin's CANCELLED transition come through this function, so one call site
  // covers both and they can never drift apart.
  queueEmail(() => sendOrderCancelledEmail(order.id));

  return { status: "cancelled", order: updated };
}
