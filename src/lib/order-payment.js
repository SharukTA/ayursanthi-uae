import { prisma } from "@/lib/prisma";
import { sendNewOrderAdminEmail, sendOrderPlacedEmail } from "@/lib/email-orders";
import { sendLogisticsDispatchEmail } from "@/lib/email-logistics";
import { queueEmail } from "@/lib/email-queue";
import { mintCouponsForOrder } from "@/lib/gift-coupons";
import { recordShopSaleDispute, recordShopSaleRefund } from "@/lib/shop";
import { getStripe, isStripeConfigured, toFils } from "@/lib/stripe";

/**
 * Write-side of the online-payment flow: the two things that can happen to a
 * Stripe order after the shopper has been sent off to pay.
 *
 * Both functions are called from more than one place — the webhook is the
 * authority, but the shopper's return page also calls confirmPaidOrder() so the
 * confirmation screen is right even when the webhook is a second or two behind.
 * Everything here is therefore written to be safe to run twice: the state change
 * is an UPDATE guarded by the row's current value, and the side effects (emails,
 * cart clearing) happen only for the caller that actually won the update.
 */

const ORDER_WITH_LINES = { items: true, payments: true };

/**
 * Marks a Stripe order paid: money in, order confirmed, cart tidied, emails out.
 *
 * @param {object} args
 * @param {string} args.orderId
 * @param {string} [args.paymentIntentId]  Stripe PaymentIntent, stored as the
 *   provider reference so a dashboard refund can be traced back to this order.
 * @param {string} [args.sessionId]        Checkout Session that collected it.
 * @param {object} [args.raw]              extra detail to keep on the payment row.
 * @returns {Promise<{status: "paid"|"already_paid"|"not_found"|"cancelled"}>}
 */
export async function confirmPaidOrder({ orderId, paymentIntentId, sessionId, raw }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_WITH_LINES,
  });

  if (!order) return { status: "not_found" };
  if (order.paymentStatus === "PAID") return { status: "already_paid", order };

  // A payment that lands on an order we already released. Stripe will not
  // complete an expired session, so this needs a genuine race to happen — but
  // if it ever does, the money is real and somebody has to give it back. Record
  // it and shout, rather than quietly banking it.
  if (order.status === "CANCELLED") {
    console.error(
      `Stripe payment ${paymentIntentId || sessionId} landed on cancelled order ` +
        `${order.orderNumber}. Refund it manually from the Stripe dashboard.`
    );
    return { status: "cancelled", order };
  }

  // Not a gate: the session was built server-side from this very order, so a
  // mismatch means our own line items are wrong, not that the shopper did
  // something. Refusing the money they have already paid would be the worse
  // response — but it must not pass unnoticed either.
  if (raw?.amountTotal != null && raw.amountTotal !== toFils(order.total)) {
    console.error(
      `Order ${order.orderNumber}: Stripe collected ${raw.amountTotal} fils but the ` +
        `order totals ${toFils(order.total)} fils. Check the line items in the checkout route.`
    );
  }

  // The guard that makes this idempotent. Two callers can reach this line at
  // once (webhook and return page); only the one whose UPDATE still sees
  // paymentStatus PENDING gets a non-zero count, and only that one goes on to
  // send emails and empty the cart.
  const claimed = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: "PENDING" },
    data: { paymentStatus: "PAID", status: "CONFIRMED" },
  });

  if (claimed.count === 0) return { status: "already_paid", order };

  const pendingPayment = order.payments.find(
    (payment) => payment.provider === "stripe" && payment.status === "PENDING"
  );

  await prisma.$transaction(async (tx) => {
    if (pendingPayment) {
      await tx.payment.update({
        where: { id: pendingPayment.id },
        data: {
          status: "PAID",
          providerPaymentId: paymentIntentId || sessionId || null,
          rawResponse: {
            ...(pendingPayment.rawResponse ?? {}),
            ...(raw ?? {}),
            sessionId: sessionId ?? null,
            paymentIntentId: paymentIntentId ?? null,
            paidAt: new Date().toISOString(),
          },
        },
      });
    }

    // Deferred from order creation: the bought lines only leave the saved cart
    // once the money is actually in, so an abandoned payment leaves the basket
    // exactly as the shopper left it. See lib/checkout.js.
    if (pendingPayment?.rawResponse?.clearAccountCart) {
      await tx.cartItem.deleteMany({
        where: {
          userId: order.userId,
          productId: { in: order.items.map((item) => item.productId) },
        },
      });
    }
  });

  // Gift coupons for the draw programme. Inside the claimed-count guard with
  // everything else, so one order mints its coupons exactly once however many
  // callers race to confirm it.
  //
  // Best-effort on purpose: the money is already taken and the order is already
  // CONFIRMED by this point, so a failure here must not throw. A missed mint
  // costs the customer some lottery tickets and can be replayed by hand from the
  // logged order id; an exception thrown after a successful payment would cost
  // them the confirmation email and the dispatch instruction below it.
  try {
    await mintCouponsForOrder({ orderId: order.id });
  } catch (error) {
    console.error(`Could not mint gift coupons for order ${order.orderNumber}:`, error.message);
  }

  // Held back until the payment cleared: an unpaid order is a reservation, and
  // must never produce a confirmation email.
  queueEmail(() => sendOrderPlacedEmail(order.id));
  queueEmail(() => sendNewOrderAdminEmail(order.id));

  // The one that actually gets the parcel moving. Delivery is run by an outside
  // courier desk working from a shared mailbox, so this email *is* the dispatch
  // instruction — see lib/email-logistics.js.
  //
  // It sits behind the claimed-count guard above with the other two for the
  // reason that matters most here: the webhook and the shopper's return page
  // both reach this function for the same order, and only the caller that won
  // the UPDATE gets this far. Without that, a routine race would book the same
  // parcel twice.
  queueEmail(() => sendLogisticsDispatchEmail(order.id));

  return { status: "paid", order };
}

/**
 * Takes back a shop's profit on a refund Stripe has told us about.
 *
 * Deliberately touches nothing on the order itself. The same event fires for the
 * refund cancelOrder() issues, and it can arrive before that cancellation has been
 * written. cancelOrder() claims the order on its current paymentStatus, so changing
 * that here could make a cancellation fail after its money had already gone back.
 *
 * @param {object} charge  the Stripe Charge from a charge.refunded event
 */
export async function recordStripeRefund(charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  const payment = paymentIntentId
    ? await prisma.payment.findUnique({
        where: { providerPaymentId: paymentIntentId },
        select: { orderId: true },
      })
    : null;
  const orderId = payment?.orderId ?? charge.metadata?.orderId;
  if (!orderId) return;

  await recordShopSaleRefund({ orderId, refundedAmount: charge.amount_refunded / 100 });
}

// A dispute the store has won, or a card inquiry closed without the money being taken.
const DISPUTE_SETTLED_FOR_STORE = ["won", "warning_closed"];

/**
 * Takes back a shop's profit while a card dispute is open or lost, and restores it if the
 * store wins. Like a refund, this touches nothing on the order itself.
 *
 * @param {object} dispute  the Stripe Dispute from a charge.dispute.* event
 * @param {number} eventCreated  the event's `created` time, in seconds
 */
export async function recordStripeDispute(dispute, eventCreated) {
  const paymentIntentId =
    typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
  if (!paymentIntentId) return;

  const payment = await prisma.payment.findUnique({
    where: { providerPaymentId: paymentIntentId },
    select: { orderId: true },
  });
  if (!payment) return;

  await recordShopSaleDispute({
    orderId: payment.orderId,
    lost: !DISPUTE_SETTLED_FOR_STORE.includes(dispute.status),
    at: new Date(eventCreated * 1000),
  });
}

/**
 * Closes out a checkout the shopper never finished.
 *
 * Expiring the Stripe session comes first, and that order matters: releasing the
 * order while its payment link is still live leaves a page that a Back button
 * can still pay for, pointing at an order that no longer exists. If expiring it
 * reveals the session was in fact paid, the payment is confirmed instead and
 * nothing is released.
 *
 * Best-effort by design. The webhook's checkout.session.expired event covers
 * anyone this misses, so a failure here costs a reservation held for its full
 * lifetime rather than correctness.
 *
 * @returns {Promise<{status: "released"|"paid"|"skipped"|"not_found"}>}
 */
export async function settleAbandonedCheckout({ orderId, reason, source = "abandoned" }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true },
  });

  if (!order) return { status: "not_found" };

  const stripePayment = order.payments.find((payment) => payment.provider === "stripe");
  const checkoutSessionId = stripePayment?.rawResponse?.sessionId;

  if (checkoutSessionId && isStripeConfigured()) {
    try {
      await getStripe().checkout.sessions.expire(checkoutSessionId);
    } catch {
      // Already expired, already paid, or Stripe is unreachable. The paid case
      // is the one that matters, and the lookup below catches it.
    }

    try {
      const checkoutSession = await getStripe().checkout.sessions.retrieve(checkoutSessionId);
      if (checkoutSession.payment_status === "paid") {
        // They did pay after all — we simply heard about it down this path
        // rather than from the webhook. Confirm it; release nothing.
        await confirmPaidOrder({
          orderId: order.id,
          sessionId: checkoutSession.id,
          paymentIntentId:
            typeof checkoutSession.payment_intent === "string"
              ? checkoutSession.payment_intent
              : checkoutSession.payment_intent?.id,
          raw: { source: `${source}_settle_check` },
        });
        return { status: "paid" };
      }
    } catch {
      // Cannot tell either way, so leave it alone and let the webhook decide.
      // Releasing an order that might have been paid is much the worse mistake.
      return { status: "skipped" };
    }
  }

  const result = await releaseUnpaidOrder({ orderId: order.id, reason });
  return { status: result.status };
}

/**
 * Closes out every checkout this shopper started and walked away from.
 *
 * Called when they begin a new one. A shopper can only be paying for one basket
 * at a time, so an older unpaid reservation of theirs is stale by definition —
 * and leaving it standing means their own abandoned attempt is what makes the
 * product look out of stock when they try again.
 */
export async function releasePreviousCheckouts(userId) {
  const stale = await prisma.order.findMany({
    where: {
      userId,
      status: "PENDING",
      paymentStatus: "PENDING",
      payments: { some: { provider: "stripe" } },
    },
    select: { id: true },
  });

  for (const order of stale) {
    try {
      await settleAbandonedCheckout({
        orderId: order.id,
        reason: "Replaced by a new checkout.",
        source: "new_checkout",
      });
    } catch (error) {
      // One stale order failing to close must never stop the shopper starting a
      // new one. The cost is a reservation that waits for its own expiry.
      console.error(`Could not settle stale checkout ${order.id}:`, error.message);
    }
  }
}

/**
 * Gives back an order whose payment never happened — the shopper abandoned
 * Stripe's page, the card was declined, or the session simply timed out.
 *
 * The stock this order was holding goes back on the shelf; that is the whole
 * point of the function. No email is sent: from the shopper's side nothing ever
 * completed, and "your order was cancelled" about an order they never finished
 * paying for reads as a mistake.
 *
 * @returns {Promise<{status: "released"|"skipped"|"not_found"}>}
 */
export async function releaseUnpaidOrder({ orderId, reason }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_WITH_LINES,
  });

  if (!order) return { status: "not_found" };

  // Only ever touch an order that is still waiting for its first payment. A paid
  // order, or one an admin has already dealt with, is none of this function's
  // business — releasing it would restock units that really did ship.
  if (order.paymentStatus !== "PENDING" || order.status !== "PENDING") {
    return { status: "skipped", order };
  }
  if (!order.payments.some((payment) => payment.provider === "stripe")) {
    return { status: "skipped", order };
  }

  // Same conditional-update guard as confirmPaidOrder: whoever flips the row out
  // of PENDING first is the one who restocks, so a duplicated webhook cannot put
  // the same units back twice.
  const claimed = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: "PENDING", status: "PENDING" },
    data: {
      status: "CANCELLED",
      paymentStatus: "FAILED",
      cancelledAt: new Date(),
      cancelledBy: "ADMIN",
      cancelReason: reason || "Online payment was not completed.",
    },
  });

  if (claimed.count === 0) return { status: "skipped", order };

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    await tx.payment.updateMany({
      where: { orderId: order.id, status: "PENDING" },
      data: { status: "FAILED" },
    });
  });

  return { status: "released", order };
}
