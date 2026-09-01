import Link from "next/link";
import { CheckCircle, Clock, Gift, XCircle } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/currency";
import { formatAddressSummary } from "@/lib/address";
import { confirmPaidOrder } from "@/lib/order-payment";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  drawInstant,
  entryCutoffFor,
  formatDrawDateTime,
  isDrawUpcoming,
} from "@/lib/gift-shared";
import { getQualifyingSpend } from "@/lib/gift-coupons";
import {
  getCancelWindowHours,
  getGiftCouponThreshold,
  getGiftDrawSchedule,
  isGiftProgramEnabled,
} from "@/lib/settings";
import { PaymentSuccessCleanup } from "./PaymentSuccessCleanup";

export const runtime = "nodejs";
// The whole point of this page is to report the state of one specific payment,
// so it must never be served from a cache.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Payment confirmed",
  robots: { index: false, follow: false },
};

const YELLOW_CTA =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#fcd200] bg-[#ffd814] px-4 text-[13px] font-semibold text-[#0f1111] shadow-[0_2px_5px_rgba(15,17,17,0.15)] transition hover:bg-[#f7ca00]";

const OUTLINE_CTA =
  "inline-flex h-9 w-full items-center justify-center rounded-lg border border-[#d5d9d9] bg-white px-4 text-[13px] font-semibold text-[#0f1111] shadow-[0_2px_5px_rgba(15,17,17,0.1)] transition hover:bg-[#f7fafa] sm:w-auto sm:px-8";

function Shell({ children }) {
  return (
    <main className="flex min-h-screen flex-col bg-white text-[#0f1111]">
      <SiteHeader />
      <div className="flex flex-1 items-center justify-center p-4">{children}</div>
      <SiteFooter />
    </main>
  );
}

/**
 * A dead end that is not a success: a missing session id, a payment that did not
 * go through, someone else's order. All of them get the same shape — say what
 * happened, and offer the two places worth going next.
 */
function Notice({ tone, title, children }) {
  const Icon = tone === "pending" ? Clock : XCircle;
  const colour = tone === "pending" ? "text-[#b45309]" : "text-[#b12704]";

  return (
    <Shell>
      <div className="w-full max-w-2xl">
        <div className="flex items-start gap-3 border-b border-[#e7e7e7] pb-5">
          <Icon className={`mt-0.5 size-8 shrink-0 ${colour}`} />
          <div>
            <h1 className={`text-2xl font-bold ${colour}`}>{title}</h1>
            <p className="mt-1 text-[13px] leading-5 text-[#565959]">{children}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/checkout" className={`${YELLOW_CTA} h-9 sm:w-auto sm:px-8`}>
            Back to checkout
          </Link>
          <Link href="/dashboard/orders" className={OUTLINE_CTA}>
            View your orders
          </Link>
        </div>
      </div>
    </Shell>
  );
}

/**
 * Where Stripe sends the shopper after a successful payment.
 *
 * This page confirms the order as a fallback, not as the primary mechanism —
 * /api/webhooks/stripe is the authority, and usually gets there first. But the
 * webhook can lag by a second or two, and a confirmation screen that says
 * "pending" about money already taken is alarming, so this page independently
 * asks Stripe whether the session was paid and calls the same idempotent
 * confirm. Whichever of the two arrives second is a no-op.
 *
 * The session id in the URL is not trusted as proof of anything: it is only used
 * to look the session up on Stripe, and the order it names is then checked
 * against the signed-in user before any of it is rendered.
 */
export default async function CheckoutSuccessPage({ searchParams }) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId || !isStripeConfigured()) {
    return (
      <Notice tone="error" title="Nothing to confirm">
        This page opens by itself after an online payment. If you were paying just now, check your
        orders — if the payment went through, the order is already there.
      </Notice>
    );
  }

  const session = await getSession();
  if (!session) {
    return (
      <Notice tone="error" title="Please sign in">
        Sign in with the account you checked out with to see this order.
      </Notice>
    );
  }

  let stripeSession;
  try {
    stripeSession = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch (error) {
    console.error("Could not retrieve Stripe session on the return page:", error.message);
    return (
      <Notice tone="pending" title="We could not reach Stripe">
        Your payment may still have gone through. Check your orders in a moment — if it did, the
        order will be there, and you will get a confirmation email.
      </Notice>
    );
  }

  const orderId = stripeSession.metadata?.orderId;
  if (!orderId) {
    return (
      <Notice tone="error" title="Payment not recognised">
        We could not match this payment to an order. Please contact us with your payment details
        and we will sort it out.
      </Notice>
    );
  }

  if (stripeSession.payment_status === "paid") {
    // Idempotent: a no-op when the webhook already did this.
    await confirmPaidOrder({
      orderId,
      sessionId: stripeSession.id,
      paymentIntentId:
        typeof stripeSession.payment_intent === "string"
          ? stripeSession.payment_intent
          : stripeSession.payment_intent?.id,
      raw: { source: "return_page" },
    });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payments: true,
      // Minted by confirmPaidOrder above, so by the time this reads they are
      // already there. Shown here rather than emailed: the store is close to
      // its transactional email cap (see lib/email-orders.js) and a fourth
      // message per order to hand over a code the customer can see on this page
      // and in their dashboard is not worth the budget.
      giftCoupons: { where: { voidedAt: null }, select: { id: true, code: true } },
    },
  });

  // Someone pasting another shopper's session id gets the same answer as a bad
  // one. Nothing about an order they do not own is disclosed.
  if (!order || order.userId !== session.userId) {
    return (
      <Notice tone="error" title="Order not found">
        We could not find this order on your account. If you have just paid, check your orders in a
        moment.
      </Notice>
    );
  }

  // Coupons are earned on cumulative spend, so an order that minted nothing may
  // still have moved the customer closer to one. Saying so here is the only
  // moment the rule is visible at the point it actually matters — otherwise a
  // sub-threshold order looks like it achieved nothing at all.
  const giftEnabled = await isGiftProgramEnabled();
  // Read whatever date the draw is scheduled for, so the date promised on the
  // receipt is the date the draw is actually held on. Null once that date has
  // passed and no new one has been chosen — the receipt then says the coupons
  // are held for the next draw rather than naming a date that has gone.
  const schedule = await getGiftDrawSchedule();
  const giftDrawDate = isDrawUpcoming(schedule.date, schedule.time)
    ? drawInstant(schedule.date, schedule.time)
    : null;
  // Whether the coupons this order just earned are in the draw named above, or
  // in the one after it.
  //
  // Entries close one cancellation window before a draw, so an order placed
  // inside those final hours earns coupons that count towards the FOLLOWING
  // draw. This page is the single worst place to get that wrong: it is the
  // receipt, it is read once, and "Entered in the draw on the 31st" is a promise
  // the customer will hold the store to. An order placed after the cutoff is
  // told plainly that it is in the next one, rather than finding out weeks later
  // when a draw they believed they were in passes without them.
  //
  // Measured on the order's own createdAt because that is exactly what becomes
  // the coupon's lastQualifiedAt (see computeLastQualifiedAt), which is the
  // value the draw actually judges.
  // Gated on the programme being on as well as a date being set, so a store with
  // the giveaway switched off does not pay for a settings read on every receipt.
  const giftEntryCutoff =
    giftEnabled && giftDrawDate
      ? entryCutoffFor(giftDrawDate, await getCancelWindowHours())
      : null;
  const giftMadeThisDraw =
    Boolean(giftEntryCutoff) && new Date(order.createdAt).getTime() < giftEntryCutoff.getTime();

  let giftThreshold = 0;
  let giftRemaining = 0;
  if (giftEnabled) {
    giftThreshold = await getGiftCouponThreshold();
    const spend = await getQualifyingSpend(order.userId);
    const towards = giftThreshold > 0 ? spend % giftThreshold : 0;
    giftRemaining = giftThreshold > 0 ? Math.round((giftThreshold - towards) * 100) / 100 : 0;
  }

  if (order.paymentStatus !== "PAID") {
    return (
      <Notice tone="pending" title="Payment not completed">
        Your order <strong>{order.orderNumber}</strong> is waiting for payment. If money has left
        your account it will be confirmed automatically within a few minutes — otherwise the order
        is released and nothing is charged.
      </Notice>
    );
  }

  const address = order.addressSnapshot ? formatAddressSummary(order.addressSnapshot) : null;

  return (
    <Shell>
      <PaymentSuccessCleanup
        productIds={order.items.map((item) => item.productId)}
        cartSource={
          order.payments.find((payment) => payment.provider === "stripe")?.rawResponse
            ?.cartSource ?? "account"
        }
      />

      <div className="w-full max-w-2xl">
        <div className="flex items-start gap-3 border-b border-[#e7e7e7] pb-5">
          <CheckCircle className="mt-0.5 size-8 shrink-0 text-[#067d62]" />
          <div>
            <h1 className="text-2xl font-bold text-[#067d62]">Payment received, thank you!</h1>
            <p className="mt-1 text-[13px] leading-5 text-[#565959]">
              Your order is confirmed and paid in full — nothing further to pay. A confirmation
              has been emailed to you and added to your orders.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-[#d5d9d9] bg-white">
          <div className="border-b border-[#e7e7e7] bg-[#f0f2f2] px-4 py-2.5 text-[13px] font-bold text-[#0f1111]">
            Order details
          </div>
          <dl className="divide-y divide-[#e7e7e7] px-4 text-[13px]">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-[#565959]">Order number</dt>
              <dd className="font-bold text-[#007185]">{order.orderNumber}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-[#565959]">Amount paid</dt>
              <dd className="text-base font-bold text-[#067d62]">{formatMoney(order.total)}</dd>
            </div>
            {address ? (
              <div className="flex justify-between gap-4 py-3">
                <dt className="shrink-0 text-[#565959]">Shipping to</dt>
                <dd className="text-right leading-5 text-[#0f1111]">{address}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {order.giftCoupons.length > 0 ? (
          <div className="mt-5 rounded-lg border border-[#d5d9d9] bg-white">
            <div className="flex items-center gap-2 border-b border-[#e7e7e7] bg-[#f0f2f2] px-4 py-2.5 text-[13px] font-bold text-[#0f1111]">
              <Gift className="size-4 text-[#067d62]" />
              You earned {order.giftCoupons.length} gift coupon
              {order.giftCoupons.length === 1 ? "" : "s"}
            </div>
            <div className="px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {order.giftCoupons.map((coupon) => (
                  <span
                    key={coupon.id}
                    className="rounded border border-[#d5d9d9] bg-[#f7fafa] px-2 py-1 font-mono text-[12px] font-bold text-[#0f1111]"
                  >
                    {coupon.code}
                  </span>
                ))}
              </div>
              <p className="mt-2.5 text-[12px] leading-5 text-[#565959]">
                {giftDrawDate && giftMadeThisDraw ? (
                  <>
                    Entered in the draw on{" "}
                    <strong className="text-[#0f1111]">
                      {formatDrawDateTime(giftDrawDate)}
                    </strong>
                    , along with every coupon you already held.{" "}
                  </>
                ) : giftDrawDate ? (
                  <>
                    Entries for the{" "}
                    <strong className="text-[#0f1111]">
                      {formatDrawDateTime(giftDrawDate)}
                    </strong>{" "}
                    draw have already closed, so these go into the next draw instead — along with
                    every coupon you already held. We close entries a little early so that no
                    coupon is in a draw while the order behind it can still be cancelled.{" "}
                  </>
                ) : (
                  <>Held for the next draw, along with every coupon you already had. </>
                )}
                <Link href="/dashboard/gifts" className="font-bold text-[#007185] hover:underline">
                  See all your coupons
                </Link>
              </p>
            </div>
          </div>
        ) : giftEnabled && giftThreshold > 0 ? (
          <div className="mt-5 rounded-lg border border-[#d5d9d9] bg-white">
            <div className="flex items-center gap-2 border-b border-[#e7e7e7] bg-[#f0f2f2] px-4 py-2.5 text-[13px] font-bold text-[#0f1111]">
              <Gift className="size-4 text-[#067d62]" />
              You&apos;re closer to a gift coupon
            </div>
            <div className="px-4 py-3">
              <p className="text-[12px] leading-5 text-[#565959]">
                Your spending adds up across orders. Spend{" "}
                <strong className="text-[#0f1111]">{formatMoney(giftRemaining)}</strong> more to
                earn a coupon for the{" "}
                {giftDrawDate && giftMadeThisDraw ? (
                  <>
                    <strong className="text-[#0f1111]">
                      {formatDrawDateTime(giftDrawDate)}
                    </strong>{" "}
                    gift draw.{" "}
                  </>
                ) : (
                  <>next gift draw. </>
                )}
                <Link href="/gifts" className="font-bold text-[#007185] hover:underline">
                  How the draw works
                </Link>
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/products" className={`${YELLOW_CTA} h-9 sm:w-auto sm:px-8`}>
            Continue shopping
          </Link>
          <Link href="/dashboard/orders" className={OUTLINE_CTA}>
            View your orders
          </Link>
        </div>
      </div>
    </Shell>
  );
}
