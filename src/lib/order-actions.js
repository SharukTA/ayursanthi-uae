import { prisma } from "@/lib/prisma";
import {
  sendNewReturnAdminEmail,
  sendOrderCancelledEmail,
  sendReturnRequestedEmail,
  sendReturnStatusEmail,
} from "@/lib/email-orders";
import { queueEmail } from "@/lib/email-queue";
import {
  CUSTOMER_WITHDRAWABLE_RETURN_STATUSES,
  NON_RESTOCKABLE_REASONS,
  RETURN_STATUS_TRANSITIONS,
  canCancelOrder,
  canReturnOrder,
  computeRefundBreakdown,
  returnableUnits,
} from "@/lib/returns";

/**
 * Write-side of the cancel / return flows. Every mutation that touches stock or
 * money lives here so the customer routes and the admin routes go through the
 * same transaction — the policy in lib/returns.js decides *whether*, this file
 * decides *what happens*.
 *
 * Money is recorded, never invented: a refund is a Payment row with
 * provider "refund", and Order.refundedTotal is the running sum of those rows.
 * The order only reads REFUNDED once that sum covers its total, so a partial
 * return leaves it PAID with a visible refunded balance.
 */

const ORDER_WITH_LINES = {
  items: true,
  returns: { include: { items: true } },
};

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function generateReturnNumber() {
  return `RET-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
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

/**
 * Opens a return/replacement request for part (or all) of a delivered order.
 *
 * The client sends order-item ids and quantities only. Amounts are recomputed
 * from the stored order, so a hand-crafted request cannot ask for more money
 * than the items are worth.
 *
 * @param {object} args
 * @param {string} args.orderId
 * @param {string} args.userId
 * @param {Array<{orderItemId: string, quantity: number}>} args.selections
 * @param {string} args.reason        ReturnReason enum value
 * @param {string} [args.comment]
 * @param {"REFUND"|"REPLACEMENT"} [args.resolution]
 * @param {string} [args.refundMethod] RefundMethod enum value (REFUND only)
 * @param {object} [args.refundDetails] bank destination snapshot (REFUND only)
 * @returns {Promise<{status: "created"|"not_found"|"forbidden"|"not_allowed", message?: string, request?: object}>}
 */
export async function createReturnRequest({
  orderId,
  userId,
  selections,
  reason,
  comment,
  resolution = "REFUND",
  refundMethod,
  refundDetails,
}) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_WITH_LINES,
  });

  if (!order) {
    return { status: "not_found", message: "Order not found." };
  }
  if (order.userId !== userId) {
    return { status: "forbidden", message: "This order does not belong to you." };
  }

  const verdict = canReturnOrder(order);
  if (!verdict.allowed) {
    return { status: "not_allowed", message: verdict.message };
  }

  // Collapse duplicates and drop empty lines before validating.
  const merged = new Map();
  for (const selection of selections ?? []) {
    const quantity = Number(selection?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) continue;
    const id = String(selection?.orderItemId || "");
    if (!id) continue;
    merged.set(id, (merged.get(id) ?? 0) + quantity);
  }

  const cleaned = [...merged.entries()].map(([orderItemId, quantity]) => ({
    orderItemId,
    quantity,
  }));

  if (cleaned.length === 0) {
    return { status: "not_allowed", message: "Select at least one item to return." };
  }

  const available = returnableUnits(order);
  const itemsById = new Map(order.items.map((item) => [item.id, item]));

  for (const selection of cleaned) {
    const item = itemsById.get(selection.orderItemId);
    if (!item) {
      return { status: "not_allowed", message: "One of the selected items is not in this order." };
    }
    if (selection.quantity > (available[selection.orderItemId] ?? 0)) {
      return {
        status: "not_allowed",
        message: `You can return at most ${available[selection.orderItemId] ?? 0} unit(s) of "${item.productName}".`,
      };
    }
  }

  const breakdown = computeRefundBreakdown(order, cleaned);

  // Nothing but the request itself is written here — stock stays put until the
  // item is physically back, and no money moves until the seller refunds.
  const request = await prisma.returnRequest.create({
    data: {
      returnNumber: generateReturnNumber(),
      orderId: order.id,
      userId,
      status: "REQUESTED",
      resolution,
      reason,
      comment: comment || null,
      refundAmount: resolution === "REFUND" ? breakdown.total : 0,
      refundMethod: resolution === "REFUND" ? refundMethod || null : null,
      refundDetails: resolution === "REFUND" ? refundDetails || null : null,
      items: {
        create: cleaned.map((selection) => ({
          orderItemId: selection.orderItemId,
          quantity: selection.quantity,
          amount: round2(Number(itemsById.get(selection.orderItemId).price) * selection.quantity),
        })),
      },
    },
    include: { items: true },
  });

  queueEmail(() => sendReturnRequestedEmail(request.id));
  queueEmail(() => sendNewReturnAdminEmail(request.id));

  return { status: "created", request, breakdown };
}

/**
 * Moves a return request along its lifecycle (seller side).
 *
 * Two steps do real work:
 *   RECEIVED  — the unit is physically back, so sellable stock is restored.
 *               Damaged/defective units are written off instead.
 *   REFUNDED  — the money goes back and the order's refunded total grows.
 *   REPLACED  — a fresh unit leaves the shelf for the replacement shipment.
 *
 * @param {object} args
 * @param {string} args.returnId
 * @param {string} args.status         target ReturnStatus
 * @param {string} [args.adminNote]
 * @param {string} [args.refundReference] transfer reference shown to the customer
 * @returns {Promise<{status: "updated"|"not_found"|"not_allowed", message?: string, request?: object}>}
 */
export async function updateReturnStatus({ returnId, status, adminNote, refundReference }) {
  const request = await prisma.returnRequest.findUnique({
    where: { id: returnId },
    include: { items: { include: { orderItem: true } }, order: true },
  });

  if (!request) {
    return { status: "not_found", message: "Return request not found." };
  }

  const allowed = RETURN_STATUS_TRANSITIONS[request.status] ?? [];
  if (!allowed.includes(status)) {
    return {
      status: "not_allowed",
      message: allowed.length
        ? `A ${request.status} return can only move to: ${allowed.join(", ")}.`
        : `This return is already ${request.status} and cannot be changed.`,
    };
  }

  if (status === "REFUNDED" && request.resolution !== "REFUND") {
    return { status: "not_allowed", message: "This request asked for a replacement, not a refund." };
  }
  if (status === "REPLACED" && request.resolution !== "REPLACEMENT") {
    return { status: "not_allowed", message: "This request asked for a refund, not a replacement." };
  }

  const now = new Date();
  const timestamps = {
    APPROVED: { approvedAt: now },
    PICKED_UP: { pickedUpAt: now },
    RECEIVED: { receivedAt: now },
    REFUNDED: { closedAt: now },
    REPLACED: { closedAt: now },
    REJECTED: { closedAt: now },
  };

  const updated = await prisma.$transaction(async (tx) => {
    if (status === "RECEIVED" && !NON_RESTOCKABLE_REASONS.includes(request.reason)) {
      for (const line of request.items) {
        await tx.product.update({
          where: { id: line.orderItem.productId },
          data: { stock: { increment: line.quantity } },
        });
      }
    }

    if (status === "REPLACED") {
      // The replacement shipment consumes sellable units of its own.
      for (const line of request.items) {
        const product = await tx.product.findUnique({ where: { id: line.orderItem.productId } });
        await tx.product.update({
          where: { id: line.orderItem.productId },
          data: { stock: Math.max(0, (product?.stock ?? 0) - line.quantity) },
        });
      }
    }

    if (status === "REFUNDED") {
      await recordRefund(tx, {
        order: request.order,
        amount: Number(request.refundAmount),
        rawResponse: {
          kind: "return_refund",
          returnNumber: request.returnNumber,
          orderNumber: request.order.orderNumber,
          method: request.refundMethod,
          reference: refundReference || null,
        },
      });
    }

    return tx.returnRequest.update({
      where: { id: request.id },
      data: {
        status,
        ...(timestamps[status] ?? {}),
        ...(adminNote !== undefined ? { adminNote: adminNote || null } : {}),
        ...(refundReference !== undefined ? { refundReference: refundReference || null } : {}),
      },
      include: { items: true },
    });
  });

  queueEmail(() => sendReturnStatusEmail(request.id, status));

  return { status: "updated", request: updated };
}

/**
 * Customer withdraws their own return request. Only possible while the item is
 * still with them — once the courier has it, the seller owns the outcome.
 */
export async function withdrawReturnRequest({ returnId, userId }) {
  const request = await prisma.returnRequest.findUnique({ where: { id: returnId } });

  if (!request) {
    return { status: "not_found", message: "Return request not found." };
  }
  if (request.userId !== userId) {
    return { status: "forbidden", message: "This return does not belong to you." };
  }
  if (!CUSTOMER_WITHDRAWABLE_RETURN_STATUSES.includes(request.status)) {
    return {
      status: "not_allowed",
      message: "This return has already been picked up and can no longer be cancelled.",
    };
  }

  const updated = await prisma.returnRequest.update({
    where: { id: request.id },
    data: { status: "CANCELLED", closedAt: new Date() },
    include: { items: true },
  });

  queueEmail(() => sendReturnStatusEmail(request.id, "CANCELLED"));

  return { status: "cancelled", request: updated };
}
