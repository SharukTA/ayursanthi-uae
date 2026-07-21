import { prisma } from "@/lib/prisma";
import { fetchRazorpayPayment } from "@/lib/razorpay";
import { applyReferralCommission } from "@/lib/referral";
import { dispatchPayout } from "@/lib/payouts";

/**
 * Turns a paid Razorpay order into a real, confirmed Order — exactly once.
 *
 * Called by BOTH the browser success path (/api/payment/razorpay/verify) and the
 * Razorpay webhook (/api/payment/razorpay/webhook). It reads the trusted
 * server-side snapshot stored in PendingCheckout (never client input), confirms
 * the payment with Razorpay, then creates the order in a single transaction.
 *
 * Idempotency: a unique constraint on Payment.providerPaymentId means a second
 * concurrent call can never create a duplicate order — it resolves to the order
 * the first call already created.
 *
 * @param {object} args
 * @param {string} args.razorpayOrderId  Razorpay order id (order_xxx)
 * @param {string} args.paymentId        Razorpay payment id (pay_xxx)
 * @param {string} [args.expectedUserId] if set, the pending checkout must belong
 *                                        to this user (browser path passes the session user)
 * @returns {Promise<{status: string, order?: object}>}
 *   status: created | already_done | not_found | forbidden | not_paid | amount_mismatch
 */
export async function finalizeRazorpayOrder({ razorpayOrderId, paymentId, expectedUserId }) {
  const pending = await prisma.pendingCheckout.findUnique({
    where: { razorpayOrderId },
  });

  if (!pending) return { status: "not_found" };

  if (expectedUserId && pending.userId !== expectedUserId) {
    return { status: "forbidden" };
  }

  // Fast path: already turned into an order by a previous call (verify or webhook).
  if (pending.status === "COMPLETED" && pending.orderId) {
    const order = await prisma.order.findUnique({ where: { id: pending.orderId } });
    if (order) return { status: "already_done", order };
  }

  // Confirm the payment is real and captured/authorized, and matches what we charged.
  const payment = await fetchRazorpayPayment(paymentId);
  if (!["captured", "authorized"].includes(payment.status)) {
    return { status: "not_paid", paymentStatus: payment.status };
  }
  const total = Number(pending.total);
  if (Math.abs(payment.amount / 100 - total) > 0.01) {
    return { status: "amount_mismatch" };
  }

  const items = Array.isArray(pending.items) ? pending.items : [];

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction in case a concurrent call just finished.
      // Bail without touching commission — it was already routed by that call.
      const fresh = await tx.pendingCheckout.findUnique({ where: { razorpayOrderId } });
      if (fresh?.status === "COMPLETED" && fresh.orderId) {
        return {
          created: await tx.order.findUnique({ where: { id: fresh.orderId } }),
          commission: null,
        };
      }

      // Decrement stock from the priced snapshot.
      for (const it of items) {
        const product = await tx.product.findUnique({ where: { id: it.productId } });
        if (!product) throw new Error("Product not found.");
        if (product.stock < it.quantity) {
          throw new Error(`Insufficient stock for "${it.productName}".`);
        }
        await tx.product.update({
          where: { id: product.id },
          data: { stock: { decrement: it.quantity } },
        });
      }

      const orderNumber = `AYUR-${Date.now().toString().slice(-6)}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: pending.userId,
          status: "CONFIRMED",
          paymentStatus: "PAID",
          subtotal: pending.subtotal,
          tax: pending.tax,
          shipping: pending.shipping,
          total: pending.total,
          addressSnapshot: pending.shippingAddress,
          items: {
            create: items.map((it) => ({
              productId: it.productId,
              productName: it.productName,
              quantity: it.quantity,
              price: it.price,
              total: it.total,
            })),
          },
          payments: {
            create: {
              provider: "razorpay",
              providerPaymentId: paymentId,
              amount: pending.total,
              status: "PAID",
              rawResponse: {
                razorpay_order_id: razorpayOrderId,
                razorpay_payment_id: paymentId,
                method: payment.method,
                status: payment.status,
                timestamp: new Date().toISOString(),
              },
            },
          },
        },
      });

      // Clear the buyer's server-side cart.
      await tx.cartItem.deleteMany({ where: { userId: pending.userId } });

      // Referral commission (1-level). Who gets it depends on whether the buyer's
      // referrer has crossed their milestone yet — before it the company retains it,
      // after it the referrer is paid automatically. See lib/referral.js.
      const commission = await applyReferralCommission(tx, { order: created });

      await tx.pendingCheckout.update({
        where: { id: pending.id },
        data: { status: "COMPLETED", orderId: created.id },
      });

      return { created, commission };
    });

    // The commission may have queued an automatic bank payout to the referrer. Fire
    // it only now that the transaction has COMMITTED — an HTTP call to RazorpayX
    // inside the transaction would hold the order's row locks open for its duration.
    // Best-effort: a payout problem leaves the money safely held for an admin and
    // must never fail the customer's order, which is already paid for and real.
    if (result.commission?.payoutWithdrawalId) {
      await dispatchPayout(result.commission.payoutWithdrawalId).catch((e) =>
        console.error("Referral payout dispatch failed:", e)
      );
    }

    return { status: "created", order: result.created };
  } catch (e) {
    // Unique violation on providerPaymentId => a concurrent call already created
    // the order for this payment. Resolve to that order instead of erroring.
    if (e?.code === "P2002") {
      const existing = await prisma.payment.findUnique({
        where: { providerPaymentId: paymentId },
        include: { order: true },
      });
      if (existing?.order) return { status: "already_done", order: existing.order };
    }
    throw e;
  }
}
