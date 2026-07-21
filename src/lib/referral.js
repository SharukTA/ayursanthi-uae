// The referral commission program. One level only — a user earns from people they
// DIRECTLY referred; there is no MLM tree.
//
// Every paid order pays a 10% commission on its subtotal, and this module decides
// WHO that commission belongs to. There are exactly two eras in a referrer's life,
// separated by the MILESTONE:
//
//   BEFORE the milestone (User.referralMilestoneAt is null)
//     The commission is RETAINED BY THE COMPANY. No money moves and no Razorpay
//     call happens — the buyer's payment already landed in the company's Razorpay
//     account, so "crediting the company" is simply the act of NOT crediting the
//     referrer. We write a CompanyEarning row purely as a ledger of that decision.
//
//   REACHING the milestone (Nth direct referral places their first paid order)
//     That Nth order's commission still goes to the company — it is one of the N.
//     In exchange the referrer receives, automatically:
//       1. a free product, picked at random from the admin-curated reward pool, and
//       2. entry to the gift draws. (Nothing to do for this one: gift eligibility is
//          DERIVED from the same qualifying-referral count — see lib/gift-draws.js
//          getDrawPopulation — so crossing the threshold enters them by itself.)
//
//   AFTER the milestone
//     Every commission from then on is THEIRS. It is credited to their wallet and
//     paid out to their bank account automatically, with no button to press (see
//     lib/payouts.js). If they have not saved payout details yet there is nowhere to
//     send it, so it accrues in the wallet and flushes itself the moment they do.
//
// The milestone is a ONE-WAY LATCH stored on the user. It is deliberately not
// recomputed per order: a later refund must not demote someone who already earned
// it, and a repeat purchase by an early referral must not be mistaken for "still
// climbing". Once crossed, always crossed.

import { prisma } from "@/lib/prisma";
import { getReferralThreshold, countQualifyingReferrals } from "@/lib/gift-draws";
import { createAutoWithdrawal } from "@/lib/payouts";

// Share of an order's subtotal paid as referral commission.
export const COMMISSION_RATE = 0.1;

export function commissionOn(subtotal) {
  return parseFloat((Number(subtotal) * COMMISSION_RATE).toFixed(2));
}

/**
 * How many direct referrals a user needs to cross the milestone.
 *
 * Intentionally the SAME number the gift draws use (SiteSetting `gift_referral_threshold`,
 * default 10) — the milestone unlocks earnings, the free product AND gift entry as one
 * event, so they must never drift apart. Change it in one place, all three follow.
 */
export const getMilestoneThreshold = getReferralThreshold;

/**
 * Pick the free product for a milestone reward: one at random from the active,
 * in-stock products the admin opted into the pool (Product.isReferralReward).
 * Returns null if the pool is empty — the milestone still happens, there is just no
 * product to give, and an admin can grant one later once the pool is stocked.
 */
export async function pickRandomRewardProduct(client = prisma) {
  const pool = await client.product.findMany({
    where: { isReferralReward: true, isActive: true, stock: { gt: 0 } },
    select: { id: true, name: true, images: { take: 1, select: { url: true } } },
  });
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Grant the milestone's free product. The unique constraint on ReferralReward.userId
 * makes this safe to attempt more than once — a second attempt is a no-op rather than
 * a second gift.
 */
export async function awardMilestoneReward(tx, userId) {
  const existing = await tx.referralReward.findUnique({ where: { userId } });
  if (existing) return existing;

  const product = await pickRandomRewardProduct(tx);
  if (!product) return null;

  return tx.referralReward.create({
    data: {
      userId,
      productId: product.id,
      productName: product.name,
      productImageUrl: product.images?.[0]?.url || null,
      quantity: 1,
    },
  });
}

/**
 * Route one paid order's referral commission. Call INSIDE the order transaction,
 * after the order row exists (its buyer must already count as a paying customer, or
 * the milestone check below would be off by one).
 *
 * Returns a plan for the caller, whose only obligation is: if `payoutWithdrawalId`
 * is set, call dispatchPayout(id) once the transaction has COMMITTED. The network
 * call is kept out of here on purpose — an HTTP request inside a transaction would
 * hold the row locks open for the duration.
 *
 * @param {object} tx      prisma transaction client
 * @param {object} args
 * @param {object} args.order      the freshly created Order (needs id, orderNumber, subtotal)
 * @returns {Promise<{outcome: "NONE"|"COMPANY"|"CUSTOMER", amount: number,
 *                    milestoneReached: boolean, reward: object|null,
 *                    payoutWithdrawalId: string|null}>}
 */
export async function applyReferralCommission(tx, { order }) {
  const none = {
    outcome: "NONE",
    amount: 0,
    milestoneReached: false,
    reward: null,
    payoutWithdrawalId: null,
  };

  const buyer = await tx.user.findUnique({
    where: { id: order.userId },
    select: { id: true, name: true, referredById: true },
  });
  if (!buyer?.referredById) return none; // organic customer — nobody to pay

  const referrerId = buyer.referredById;
  const amount = commissionOn(order.subtotal);
  if (amount <= 0) return none;

  const referrer = await tx.user.findUnique({
    where: { id: referrerId },
    select: { id: true, referralMilestoneAt: true },
  });
  if (!referrer) return none;

  // ── Era 2: past the milestone. The money is theirs. ───────────────────────────
  if (referrer.referralMilestoneAt) {
    // Upsert, not findUnique: a referrer who never had a wallet row must not have
    // their commission silently dropped on the floor.
    const wallet = await tx.wallet.upsert({
      where: { userId: referrerId },
      create: { userId: referrerId, balance: amount },
      update: { balance: { increment: amount } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "CREDIT",
        amount,
        description: `Referral commission (10%) from ${buyer.name}'s purchase (Order ${order.orderNumber})`,
        referenceType: "ORDER",
        referenceId: order.id,
      },
    });

    // Sweep the balance out to their bank if they have details on file and it has
    // reached the payout minimum. Returns null (money simply waits in the wallet)
    // when they haven't added a bank account yet.
    const withdrawal = await createAutoWithdrawal(tx, referrerId);

    return {
      outcome: "CUSTOMER",
      amount,
      milestoneReached: false,
      reward: null,
      payoutWithdrawalId: withdrawal?.id || null,
    };
  }

  // ── Era 1: still climbing. The company keeps it. ──────────────────────────────
  // No wallet credit, no Razorpay call — the payment is already in the company's
  // account. This row is the ledger entry, not a money movement.
  await tx.companyEarning.create({
    data: {
      type: "PRE_MILESTONE_REFERRAL_COMMISSION",
      amount,
      referrerId,
      buyerId: buyer.id,
      buyerName: buyer.name,
      orderId: order.id,
      orderNumber: order.orderNumber,
      description: `Pre-milestone referral commission (10%) retained from ${buyer.name}'s Order ${order.orderNumber}`,
    },
  });

  // Did this order just complete the milestone? The buyer's order is already PAID at
  // this point, so they are counted here — meaning the Nth referral's first purchase
  // is what tips it, exactly as intended.
  const [threshold, qualifying] = await Promise.all([
    getMilestoneThreshold(tx),
    countQualifyingReferrals(tx, referrerId),
  ]);

  if (qualifying < threshold) {
    return { outcome: "COMPANY", amount, milestoneReached: false, reward: null, payoutWithdrawalId: null };
  }

  // Milestone crossed. Latch it, and hand over the free product. Gift-draw entry
  // needs no action — it is derived from this same count.
  await tx.user.update({
    where: { id: referrerId },
    data: { referralMilestoneAt: new Date() },
  });
  const reward = await awardMilestoneReward(tx, referrerId);

  return { outcome: "COMPANY", amount, milestoneReached: true, reward, payoutWithdrawalId: null };
}
