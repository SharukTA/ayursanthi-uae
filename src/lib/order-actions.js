import { prisma } from "@/lib/prisma";
import { sendOrderCancelledEmail } from "@/lib/email-orders";
import { sendLogisticsCancelEmail } from "@/lib/email-logistics";
import { queueEmail } from "@/lib/email-queue";
import {
  CANCELLABLE_ORDER_STATUSES,
  canCancelOrder,
  cancelWindowCutoff,
} from "@/lib/order-policy";
import { getCancelWindowHours } from "@/lib/settings";
import { reconcileCouponsForUser, voidCouponsForOrder } from "@/lib/gift-coupons";
import { getStripe, isStripeConfigured, toFils } from "@/lib/stripe";
import { revalidateCommunityStats } from "@/lib/page-sections";

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
  // Needed to find the PaymentIntent a refund has to be issued against, and to
  // recognise a legacy Cash-on-Delivery order, which has no gateway to call.
  payments: true,
};

/**
 * Thrown inside the cancellation transaction when the claim below finds the
 * order is no longer cancellable, to unwind everything the transaction has done
 * so far. Caught immediately outside it and turned back into a "not_allowed".
 *
 * A sentinel class rather than a flag, because the only way to abandon work
 * already done inside a Prisma interactive transaction is to throw out of it.
 */
class OrderNoLongerCancellable extends Error {
  constructor(message) {
    super(message);
    this.name = "OrderNoLongerCancellable";
  }
}

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
 * Stock is only given back when the parcel never reached the customer. That used
 * to be a flag checked here; it is now structural — the claim guard inside the
 * transaction will only cancel an order whose status is still in
 * CANCELLABLE_ORDER_STATUSES, so a DELIVERED order can never reach the restock
 * loop and no admin can conjure units that are sitting in someone's home.
 *
 * The cancellation window (order_cancel_window_hours, see lib/order-policy.js)
 * is enforced twice: once up front for a clean refusal, and once again in SQL at
 * the moment of the write, so an order that expires mid-request cannot slip
 * through and two racing requests cannot both restock or both refund.
 *
 * Payment:
 *   - never paid (PENDING) -> the pending Payment rows go FAILED, because
 *     nothing will ever be taken for this order;
 *   - paid (PAID) -> the full outstanding value is refunded to the card through
 *     Stripe before anything is written down, and the cancellation is abandoned
 *     if that fails. A legacy Cash-on-Delivery order has no gateway to call, so
 *     its refund stays what it always was: a ledger entry describing cash
 *     handed back at the door.
 *
 * @param {object} args
 * @param {string} args.orderId
 * @param {string} [args.userId]  when set, the order must belong to this user
 * @param {"CUSTOMER"|"ADMIN"} args.actor
 * @param {string} [args.reason]
 * @returns {Promise<{status: "cancelled"|"not_found"|"forbidden"|"not_allowed"|"refund_failed", expired?: boolean, message?: string, order?: object}>}
 *   `expired` marks the one refusal the caller should act on rather than offer a
 *   retry: the cancellation window has shut, so there is no button left to press.
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

  // The same window binds both sides of the counter.
  //
  // The store used to be able to pull the plug at any point, on the reasoning
  // that a seller cancelling for stock or address reasons should never be
  // blocked. That reasoning does not survive the courier handoff: once the
  // parcel has been collected, "cancelling" refunds the card and returns stock
  // for goods that are on a van, and the store is left chasing a recall with a
  // settled ledger saying the order never happened. So an admin gets the same
  // verdict a customer does, and past the window the way out is the courier's
  // desk — not this button.
  const windowHours = await getCancelWindowHours();
  // One instant for the whole call. The verdict below and the SQL guard further
  // down are the same test asked twice, and asking it against two different
  // "now"s is how an order becomes cancellable in the check and expired in the
  // write for reasons nobody can reproduce.
  const now = new Date();
  const verdict = canCancelOrder(order, { windowHours, now });
  if (!verdict.allowed) {
    // An admin cancelling an order that is *already* cancelled is the one case
    // worth wording separately, because it is a double-click rather than a
    // policy breach — and canCancelOrder already says exactly that.
    return { status: "not_allowed", expired: verdict.expired, message: verdict.message };
  }

  // The money goes back before a single row is written.
  //
  // Order matters, and this is the only order that is safe. Recording the refund
  // first and calling Stripe afterwards would, on a failed call, leave an order
  // reading REFUNDED with the charge still standing — an inconsistency nothing
  // downstream can detect, because the ledger looks perfectly settled. So a
  // failed refund abandons the whole cancellation instead: the order stays as it
  // was, and the customer or admin can try again.
  //
  // A legacy Cash-on-Delivery order never enters this branch — it has no Stripe
  // payment row, so its "refund" stays a record of cash handed back at the door.
  let stripeRefund = null;
  if (order.paymentStatus === "PAID") {
    const paidOnline = order.payments.find(
      (payment) =>
        payment.provider === "stripe" && payment.status === "PAID" && payment.providerPaymentId
    );
    const outstanding = round2(Number(order.total) - Number(order.refundedTotal ?? 0));

    if (paidOnline && outstanding > 0) {
      if (!isStripeConfigured()) {
        console.error(
          `Cannot refund order ${order.orderNumber}: it was paid by card but Stripe is not configured.`
        );
        return {
          status: "refund_failed",
          message:
            "This order was paid by card and cannot be refunded right now. Please try again shortly.",
        };
      }

      try {
        stripeRefund = await getStripe().refunds.create({
          payment_intent: paidOnline.providerPaymentId,
          amount: toFils(outstanding),
          metadata: { orderId: order.id, orderNumber: order.orderNumber },
        });
      } catch (error) {
        console.error(`Stripe refund failed for order ${order.orderNumber}:`, error.message);
        return {
          status: "refund_failed",
          message:
            "We could not refund the card payment, so the order has not been cancelled. Please try again shortly.",
        };
      }
    }
  }

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      // Claim the order before touching anything else.
      //
      // The same conditional-update guard releaseUnpaidOrder() uses in
      // lib/order-payment.js, and for the same reason: everything below —
      // restocking, the refund ledger row, voiding coupons — is work that must
      // happen exactly once, and the check at the top of this function was made
      // against a row read seconds ago and outside any transaction. Whoever
      // flips the row out of a cancellable state first is the one who does that
      // work; everybody else finds count === 0 and unwinds.
      //
      // The WHERE clause re-asserts every precondition the decisions below rest
      // on, not just the status:
      //
      //   createdAt   the cancellation window, restated in SQL via
      //               cancelWindowCutoff() so it cannot drift from the
      //               in-memory verdict. This is what stops an order that
      //               expired mid-request from being cancelled anyway — the
      //               boundary is enforced by the database, at the instant of
      //               the write.
      //   status      blocks a second cancel, and anything the courier has.
      //   paymentStatus  the branch below reads it to decide between refunding
      //               and marking the payment FAILED. If a Stripe webhook
      //               flipped PENDING to PAID while we were deciding, that
      //               choice is now wrong, and this refuses the write rather
      //               than marking a genuinely paid order as never-paid.
      //   userId      belt and braces on the ownership check above, so a
      //               customer-scoped cancel can never write another user's row.
      const claimed = await tx.order.updateMany({
        where: {
          id: order.id,
          status: { in: CANCELLABLE_ORDER_STATUSES },
          paymentStatus: order.paymentStatus,
          createdAt: { gt: cancelWindowCutoff(windowHours, now) },
          ...(userId ? { userId } : {}),
        },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancelledBy: actor === "ADMIN" ? "ADMIN" : "CUSTOMER",
          cancelReason: reason || null,
        },
      });

      if (claimed.count === 0) {
        throw new OrderNoLongerCancellable(
          "This order can no longer be cancelled. Please reload the page for its current status."
        );
      }

      // Only now, holding the claim, is it safe to move stock: a request that
      // lost the race above never reaches this line, so units cannot be put
      // back twice for one order.
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      if (order.paymentStatus === "PAID") {
        await recordRefund(tx, {
          order,
          amount: Number(order.total) - Number(order.refundedTotal ?? 0),
          rawResponse: {
            kind: "cancellation_refund",
            orderNumber: order.orderNumber,
            cancelledBy: actor,
            reason: reason || null,
            // "stripe" means the money has already left Stripe by this point;
            // "cash" means somebody hands notes back at the door.
            method: stripeRefund ? "stripe" : "cash",
            stripeRefundId: stripeRefund?.id ?? null,
          },
        });
      } else if (order.paymentStatus === "PENDING") {
        // An order that was never paid for: nothing was ever collected, so there
        // is nothing to send back.
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED" } });
        await tx.payment.updateMany({
          where: { orderId: order.id, status: "PENDING" },
          data: { status: "FAILED" },
        });
      }

      // Gift coupons this order earned are pulled out of play. Inside the same
      // transaction as the cancellation itself, because a cancelled order that
      // still holds live lottery tickets is the one inconsistency here that
      // actually costs money.
      //
      // Voided, not deleted: the code may already sit in a frozen draw's entry
      // list, and deleting the row it points at would tear a hole in an audit
      // trail whose whole purpose is to be immutable.
      await voidCouponsForOrder({
        orderId: order.id,
        reason:
          `On hold — order ${order.orderNumber} was cancelled. ` +
          `It comes back as soon as you qualify again.`,
        client: tx,
      });

      return tx.order.findUnique({ where: { id: order.id }, include: ORDER_WITH_LINES });
    });
  } catch (error) {
    // The order slipped out of a cancellable state between the check at the
    // top of this function and the write. Nothing was committed — the
    // transaction rolled back — so this is a plain refusal, not a failure.
    if (error instanceof OrderNoLongerCancellable) {
      if (stripeRefund) {
        // Money left Stripe and the cancellation did not stick. Vanishingly
        // unlikely (a competing cancel would have had to refund the same
        // PaymentIntent first, which Stripe refuses), but it is real money,
        // so it is logged loudly rather than swallowed with the refusal.
        console.error(
          `Refund ${stripeRefund.id} was issued for order ${order.orderNumber} but the ` +
            `cancellation could not be committed. Reconcile this order by hand.`
        );
      }
      return { status: "not_allowed", expired: false, message: error.message };
    }
    throw error;
  }

  // Coupons are earned on cumulative spend, so pulling one order changes what
  // the WHOLE account has earned — not just what this order minted. Voiding
  // above handles the coupons attributed to this order; this second pass
  // recomputes the total and voids any further surplus, which is what catches
  // the interleaved case: a 20 AED order and an 80 AED order together earned one
  // coupon attributed to the second, and cancelling the FIRST has to remove it
  // even though that order minted nothing.
  //
  // Outside the transaction and best-effort. The cancellation and the refund
  // have already happened and must stand; a coupon count that is briefly too
  // generous is self-correcting on the customer's next purchase, whereas
  // failing the cancel over it would leave money unreturned.
  try {
    await reconcileCouponsForUser({ userId: order.userId });
  } catch (error) {
    console.error(
      `Could not reconcile gift coupons after cancelling ${order.orderNumber}:`,
      error?.message || error
    );
  }

  // Sent from here, not the routes: both the customer's cancel button and the
  // admin's CANCELLED transition come through this function, so one call site
  // covers both and they can never drift apart.
  queueEmail(() => sendOrderCancelledEmail(order.id));

  // The courier desk was told to ship this. Refunding the customer while an
  // outside company still holds a live booking against their address is how a
  // cancelled order turns up at somebody's door anyway, so they get told to
  // stop. Self-limiting: the sender returns early for an order that was never
  // dispatched, which is every order cancelled before payment cleared.
  queueEmail(() => sendLogisticsCancelEmail(order.id));

  // The "N successful bookings" ticker counts orders whose paymentStatus is
  // PAID, and a full refund has just moved this one out of that bucket — so the
  // cached pages showing the number are now a booking ahead of reality.
  //
  // REFUNDED is the precise test rather than "was it cancelled": a cancelled
  // order that was never paid lands on FAILED and was never counted, and an
  // order already refunded down to zero keeps its PAID badge (recordRefund
  // returns early on a zero-value refund) and so is still being counted.
  // Either way the number has not moved and there is nothing to invalidate.
  //
  // Safe to sit inside this function rather than at the call sites, which is
  // where the equivalent call for a *paid* order has to live: both routes that
  // cancel are Route Handlers, and nothing cancels an order mid-render.
  if (updated?.paymentStatus === "REFUNDED") {
    revalidateCommunityStats();
  }

  return { status: "cancelled", order: updated };
}
