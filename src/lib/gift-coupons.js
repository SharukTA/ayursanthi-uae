// Gift coupons: minting them when an order is paid, and voiding them when one
// is pulled.
//
// The rule, in full. Coupons are earned on CUMULATIVE goods spend, not per
// order: every whole multiple of the threshold a customer has spent since the
// programme began earns one coupon. So a 20 AED order followed by an 80 AED one
// earns the same single coupon a lone 100 AED order would, and 250 AED earns two
// with 50 carried forward towards the next.
//
// Coupons never expire. What they do instead is go dormant — a coupon only
// enters a draw if its owner shopped inside that draw's cycle — and a qualifying
// purchase wakes up EVERY coupon the customer holds, not just the new ones. That
// is what makes a returning customer's entries accumulate.
//
// Nothing here stores a running balance. The count a customer is owed is
// recomputed from their order history every time, which is what makes a
// cancellation walk the balance back down correctly — and, when they qualify
// again, bring the very same codes back rather than printing new ones. See
// reconcileCouponsForUser.
//
// Server-only. The calendar half of this (which cycle is "now", what window a
// draw covers) lives in lib/gift-shared.js so the browser can use it too.

import { prisma } from "@/lib/prisma";
import {
  getGiftCouponThreshold,
  getGiftProgramStart,
  isGiftProgramEnabled,
} from "@/lib/settings";

// Same alphabet as the affiliate IDs in lib/referral.js, and for the same
// reason: these codes get read off a screen, printed, and typed back in, so I
// and O are omitted to kill the "I vs 1" / "O vs 0" ambiguity.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
const CODE_GROUP_LENGTH = 4;
const CODE_GROUPS = 2;
const CODE_PREFIX = "AYS";

// A coupon is a lottery ticket, so the number a single reconcile can mint is
// capped. Without this a single mistyped price — or a genuine bulk order —
// quietly turns into thousands of entries and skews every subsequent draw.
// Hitting the cap is logged rather than silently swallowed.
const MAX_COUPONS_PER_MINT = 50;

const MAX_MINT_ATTEMPTS = 8;

/**
 * One candidate code, e.g. "AYS-7K2D-M4X1".
 *
 * Grouped with dashes purely for legibility when it is read aloud or copied off
 * a confirmation page. The dashes are part of the stored code, so lookups are
 * exact and there is no normalisation step to get wrong.
 */
export function generateCouponCode() {
  const groups = [];
  for (let g = 0; g < CODE_GROUPS; g += 1) {
    let group = "";
    for (let i = 0; i < CODE_GROUP_LENGTH; i += 1) {
      group += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    groups.push(group);
  }
  return `${CODE_PREFIX}-${groups.join("-")}`;
}

/**
 * Mint `count` codes that are free in the database.
 *
 * The check is advisory, exactly as in lib/referral.js — two concurrent mints
 * can both pass it. The @unique index on GiftCoupon.code is the real guard and
 * the caller retries on the write conflict. `pending` stops one batch colliding
 * with itself, which the database check alone would not catch.
 */
async function reserveCodes(count, client) {
  const pending = new Set();

  for (let attempt = 0; attempt < MAX_MINT_ATTEMPTS && pending.size < count; attempt += 1) {
    const candidates = [];
    while (candidates.length < count - pending.size) {
      const code = generateCouponCode();
      if (!pending.has(code)) candidates.push(code);
    }

    const taken = await client.giftCoupon.findMany({
      where: { code: { in: candidates } },
      select: { code: true },
    });
    const takenSet = new Set(taken.map((row) => row.code));

    for (const code of candidates) {
      if (!takenSet.has(code)) pending.add(code);
    }
  }

  // Every roll collided, which means something is wrong with the randomness
  // rather than with the data. Fall back to codes that cannot collide by
  // construction, the same way createUniqueReferralCode does.
  while (pending.size < count) {
    pending.add(`${CODE_PREFIX}-${Date.now().toString(36).toUpperCase()}-${pending.size}`);
  }

  return [...pending].slice(0, count);
}

/**
 * How many coupons a given amount of qualifying spend has earned in total.
 *
 * Exported so the storefront copy and the admin screens compute "you have
 * earned N coupons" with the very function that later mints them.
 */
export function couponCountFor(spend, threshold) {
  const amount = Number(spend);
  const step = Number(threshold);
  if (!Number.isFinite(amount) || !Number.isFinite(step) || step <= 0) return 0;
  // Scaled to integer fils before dividing. In floating point, 300 / 100 can
  // land on 2.9999999999999996 once the amount has been through a Decimal
  // round-trip, and Math.floor would then rob the customer of a coupon they
  // paid for.
  return Math.max(0, Math.floor(Math.round(amount * 100) / Math.round(step * 100)));
}

/**
 * Everything this customer has spent that counts towards gift coupons.
 *
 * Coupons are earned on CUMULATIVE spend, not per order: a 20 AED order
 * followed by an 80 AED order earns the same one coupon a single 100 AED order
 * would. So the question is never "what did this order do" but "what has this
 * customer spent in total", and that is what this answers.
 *
 * Three filters define "counts":
 *   - the money actually cleared (PAID);
 *   - the order was not later pulled, so a cancellation walks the coupon
 *     balance back down;
 *   - it was placed on or after the programme started, so going live does not
 *     convert the entire back catalogue into coupons.
 */
export async function getQualifyingSpend(userId, client = prisma) {
  const programStart = await getGiftProgramStart();

  const result = await client.order.aggregate({
    _sum: { subtotal: true },
    where: {
      userId,
      paymentStatus: "PAID",
      status: { not: "CANCELLED" },
      createdAt: { gte: programStart },
    },
  });

  return Number(result._sum.subtotal ?? 0);
}

/**
 * When this customer last CROSSED a threshold — the instant that decides which
 * draw their coupons are in.
 *
 * Derived by replaying their orders rather than stamped at the time, and that
 * is the whole point. A stamp written as "now" can only ever move forward, so
 * cancelling the order that woke a customer's coupons up would leave them awake
 * on the strength of an order that was refunded — free entries for anyone who
 * buys, waits for the reactivation, and cancels. Replaying the history has no
 * such hole: take the order away and the crossing it caused simply is not
 * there any more.
 *
 * Crossing, not merely spending. A 5 AED top-up adds to the running total but
 * does not earn a coupon, and it must not wake a dormant collection either —
 * the rule customers are told is that another full threshold of spending brings
 * their coupons back.
 *
 * @returns {Promise<Date|null>} null when they have never reached the threshold
 */
export async function computeLastQualifiedAt(userId, threshold) {
  if (!Number.isFinite(threshold) || threshold <= 0) return null;

  const programStart = await getGiftProgramStart();
  const orders = await prisma.order.findMany({
    where: {
      userId,
      paymentStatus: "PAID",
      status: { not: "CANCELLED" },
      createdAt: { gte: programStart },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, subtotal: true },
  });

  let running = 0;
  let lastCrossing = null;

  for (const order of orders) {
    const before = couponCountFor(running, threshold);
    running += Number(order.subtotal);
    const after = couponCountFor(running, threshold);
    // This order tipped the running total past at least one more whole
    // threshold, so it is the kind of purchase that earns a coupon and wakes
    // the rest.
    if (after > before) lastCrossing = order.createdAt;
  }

  return lastCrossing;
}

/**
 * Bring a customer's coupons into line with what they have actually spent.
 *
 * The single source of truth for both halves of a customer's coupon state: how
 * many they hold, and which draw those are in. Everything calls it — a paid
 * order, a cancellation, an admin fixing something up.
 *
 * Nothing is tracked as a delta. Both answers are recomputed from the order
 * history every time:
 *
 *   earned          = floor(total qualifying spend / threshold)
 *   lastQualifiedAt = when they last crossed a threshold
 *
 * Recomputing rather than adding and subtracting is what makes cancellation
 * correct without a ledger. Delta arithmetic has to answer "how much of THIS
 * order's money had already been converted into a coupon", which is
 * unanswerable once orders interleave: a 20 AED order and an 80 AED order
 * together mint one coupon, and there is no honest way to say which of the two
 * paid for it. Recomputing sidesteps the question — cancel either one and the
 * total simply drops back below the threshold. The same trick fixes the
 * activity stamp, which a "set it to now" approach could never walk backwards.
 *
 * Idempotent and self-healing: run it twice and the second run finds nothing to
 * do, and a mint that failed halfway is corrected by the next purchase.
 *
 * @param {object} args
 * @param {string} args.userId
 * @param {string} [args.sourceOrderId]  order to attribute new coupons to
 */
export async function reconcileCouponsForUser({ userId, sourceOrderId }) {
  const threshold = await getGiftCouponThreshold();
  const spend = await getQualifyingSpend(userId);
  const earned = couponCountFor(spend, threshold);
  const qualifiedAt = await computeLastQualifiedAt(userId, threshold);

  const live = await prisma.giftCoupon.count({ where: { userId, voidedAt: null } });

  let voided = 0;
  let restoredCodes = [];
  let mintedCodes = [];

  // ── Holding more than the spend now earns: an order was cancelled ─────────
  if (live > earned) {
    const surplus = live - earned;

    // Newest first, so the customer keeps their longest-standing codes. Never
    // touches a coupon already frozen into a draw or tied to a win: those sit
    // on a record that has to stay readable, and quietly removing somebody
    // from a draw they were in would make the audit trail a lie.
    const removable = await prisma.giftCoupon.findMany({
      where: { userId, voidedAt: null, entries: { none: {} }, wins: { none: {} } },
      orderBy: { createdAt: "desc" },
      take: surplus,
      select: { id: true },
    });

    if (removable.length > 0) {
      await prisma.giftCoupon.updateMany({
        where: { id: { in: removable.map((coupon) => coupon.id) } },
        data: {
          voidedAt: new Date(),
          voidReason:
            "On hold — a cancelled order took your total below the threshold. " +
            "It comes back as soon as you qualify again.",
        },
      });
      voided = removable.length;
    }

    if (removable.length < surplus) {
      // The remainder are locked into a draw. Left standing on purpose — an
      // admin can see the imbalance on the winners screen and decide.
      console.warn(
        `User ${userId} holds ${surplus - removable.length} more gift coupon(s) than their ` +
          `spend now earns, but those are already entered in a draw and were left in place.`
      );
    }
  }

  // ── Owed coupons ──────────────────────────────────────────────────────────
  if (earned > live) {
    let owed = earned - live;
    if (owed > MAX_COUPONS_PER_MINT) {
      console.warn(
        `User ${userId} is owed ${owed} gift coupons at once, which exceeds the cap of ` +
          `${MAX_COUPONS_PER_MINT}. Awarding the cap; the rest follow on their next purchase.`
      );
      owed = MAX_COUPONS_PER_MINT;
    }

    // Bring held codes back before printing new ones.
    //
    // Without this, a customer who cancels an order and re-places it watches a
    // code they were shown die and an unfamiliar one appear in its place —
    // which reads as a bug, and quietly contradicts the promise the whole
    // programme is built on, that a coupon never expires.
    //
    // Oldest first, so the code that comes back is the one they have had
    // longest. Coupons frozen into a draw or tied to a win are left alone,
    // mirroring the surplus sweep above: reviving a ticket that a draw has
    // already passed over would put it back in a drum it was excluded from.
    const restorable = await prisma.giftCoupon.findMany({
      where: { userId, voidedAt: { not: null }, entries: { none: {} }, wins: { none: {} } },
      orderBy: { createdAt: "asc" },
      take: owed,
      select: { id: true, code: true },
    });

    const mintCount = owed - restorable.length;
    const codes = mintCount > 0 ? await reserveCodes(mintCount, prisma) : [];

    await prisma.$transaction(async (tx) => {
      if (restorable.length > 0) {
        await tx.giftCoupon.updateMany({
          where: { id: { in: restorable.map((coupon) => coupon.id) } },
          data: {
            voidedAt: null,
            voidReason: null,
            // Re-attributed to the order that revived it. The field means "the
            // paid order this coupon is earned by", and after restoration that
            // is this order — the original was cancelled and earns nothing.
            ...(sourceOrderId ? { sourceOrderId } : {}),
          },
        });
      }

      if (codes.length > 0) {
        await tx.giftCoupon.createMany({
          data: codes.map((code) => ({
            code,
            userId,
            sourceOrderId,
            // Overwritten by the stamping pass below; set here only because the
            // column is required.
            lastQualifiedAt: qualifiedAt ?? new Date(),
          })),
        });
      }
    });

    restoredCodes = restorable.map((coupon) => coupon.code);
    mintedCodes = codes;
  }

  // ── Which draw the surviving coupons are in ───────────────────────────────
  //
  // One stamp for the whole collection, and the reason a returning customer's
  // entries pile up: crossing the threshold again wakes EVERY coupon they hold,
  // not just the new ones. Applied last so it covers coupons that were just
  // minted or restored as well as ones they already had.
  //
  // Because the value is derived, this also walks the stamp BACKWARDS when an
  // order is cancelled: the crossing that woke them disappears with the order,
  // and the collection falls back to whenever they last genuinely qualified.
  if (qualifiedAt) {
    await prisma.giftCoupon.updateMany({
      where: { userId, voidedAt: null },
      data: { lastQualifiedAt: qualifiedAt },
    });
  }

  const codes = [...restoredCodes, ...mintedCodes];
  const status =
    voided > 0 ? "voided" : codes.length === 0 ? "up_to_date" : mintedCodes.length ? "minted" : "restored";

  return {
    status,
    minted: mintedCodes.length,
    restored: restoredCodes.length,
    voided,
    codes,
    spend,
    earned,
    qualifiedAt,
  };
}

/**
 * Award whatever a newly paid order has earned.
 *
 * A thin wrapper over reconcileCouponsForUser: the order matters only because
 * it is what makes the call happen and what new coupons are attributed to. The
 * amount that decides how many are minted is the customer's running total,
 * which now includes this order.
 *
 * Called from confirmPaidOrder() inside the block guarded by its conditional
 * UPDATE. The reconcile is idempotent regardless, so a replayed webhook or a
 * manual re-run cannot double-mint.
 *
 * Deliberately quiet on failure. A coupon is a promotional extra; an exception
 * here must never roll back a payment that has already been taken, so the
 * caller treats this as best-effort and logs the error for someone to replay.
 *
 * @param {object} args
 * @param {string} args.orderId
 */
export async function mintCouponsForOrder({ orderId, client = prisma }) {
  if (!(await isGiftProgramEnabled())) {
    return { status: "programme_off", minted: 0, codes: [] };
  }

  const order = await client.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, subtotal: true, paymentStatus: true, status: true },
  });

  if (!order) return { status: "not_found", minted: 0, codes: [] };

  // Only a paid, live order triggers anything. Guarding on stored state rather
  // than trusting the caller means a mistaken call cannot award coupons off an
  // order that was never paid for or has since been pulled.
  if (order.paymentStatus !== "PAID" || order.status === "CANCELLED") {
    return { status: "not_eligible", minted: 0, codes: [] };
  }

  return reconcileCouponsForUser({ userId: order.userId, sourceOrderId: order.id });
}

/**
 * Void every coupon an order earned, because the order was cancelled.
 *
 * Voided, never deleted: the code may already be sitting in a frozen draw's
 * entry list, and deleting the row it points at would tear a hole in an audit
 * trail whose entire purpose is to be immutable. A voided coupon is filtered out
 * when the NEXT draw is frozen.
 *
 * Note what is deliberately not undone: the reactivation this order gave the
 * customer's other coupons. Rolling that back correctly would mean knowing what
 * each stamp was beforehand, and getting it wrong would silently disqualify
 * coupons earned by orders that were never cancelled. Leaving a cancelled order
 * having woken up coupons the customer had already legitimately earned is much
 * the smaller error.
 *
 * @returns {Promise<{voided: number}>}
 */
export async function voidCouponsForOrder({ orderId, reason, client = prisma }) {
  const result = await client.giftCoupon.updateMany({
    where: { sourceOrderId: orderId, voidedAt: null },
    data: {
      voidedAt: new Date(),
      voidReason: reason ||
        "On hold — the order that earned this coupon was cancelled. It comes back as soon as you qualify again.",
    },
  });

  return { voided: result.count };
}

/**
 * A customer's coupons, newest first, with their source order for display.
 * Voided coupons are included — the customer should be able to see that a code
 * they were shown is no longer in play, and why.
 */
export async function getCouponsForUser(userId) {
  return prisma.giftCoupon.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      lastQualifiedAt: true,
      voidedAt: true,
      voidReason: true,
      createdAt: true,
      sourceOrder: { select: { id: true, orderNumber: true, createdAt: true } },
    },
  });
}
