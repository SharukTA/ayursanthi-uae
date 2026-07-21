// Gift-draw program rules and the draw engine.
//
// The model (see GIFT ITEMS LIST AYURSANTHI 2026): gifts are fixed per milestone
// TIER. When the number of paying customers reaches a tier's memberThreshold, an
// admin runs the draw and, for EACH gift line in that tier, one random ELIGIBLE
// customer is drawn as the winner. The winner receives `quantity` units of the
// gift, and their DIRECT referrer receives the same gift + quantity (a mirror).
//
// Eligibility (only DIRECT referrals count, and only those who actually paid):
//   the customer has purchased a product (>=1 PAID order) AND has referred at
//   least `threshold` (default 10) direct referrals who each have a PAID order.

import { prisma } from "@/lib/prisma";

// TESTING: temporarily lowered from 10 to 1 so a single referral unlocks the
// gift page. REVERT to 10 before shipping.
export const DEFAULT_REFERRAL_THRESHOLD = 10;
const THRESHOLD_KEY = "gift_referral_threshold";

// The number of qualifying direct referrals a customer needs to take part in the
// draws. Stored (optionally) in SiteSetting so it can be tuned without a deploy.
export async function getReferralThreshold(client = prisma) {
  try {
    const row = await client.siteSetting.findUnique({ where: { key: THRESHOLD_KEY } });
    const n = Number.parseInt(row?.value ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_REFERRAL_THRESHOLD;
  } catch {
    return DEFAULT_REFERRAL_THRESHOLD;
  }
}

// Count a user's DIRECT referrals who have placed at least one PAID order — the
// number compared against the eligibility threshold. `client` may be the prisma
// singleton or a transaction client.
export async function countQualifyingReferrals(client, userId) {
  return client.user.count({
    where: {
      referredById: userId,
      orders: { some: { paymentStatus: "PAID" } },
    },
  });
}

// Whether a single user has purchased anything (>=1 PAID order).
export async function hasPurchased(client, userId) {
  const count = await client.order.count({
    where: { userId, paymentStatus: "PAID" },
  });
  return count > 0;
}

// Load the paying-customer set once and derive BOTH the milestone count and the
// set of eligible customer ids in a single pass. Counting each buyer's paying
// direct referrals is done by tallying buyers against their referredById — a
// buyer referred by X contributes one qualifying referral to X.
export async function getDrawPopulation(client = prisma, threshold) {
  const t = threshold ?? (await getReferralThreshold(client));

  const buyers = await client.user.findMany({
    where: {
      role: { not: "ADMIN" },
      orders: { some: { paymentStatus: "PAID" } },
    },
    select: { id: true, referredById: true },
  });

  const qualifyingByReferrer = new Map();
  for (const b of buyers) {
    if (b.referredById) {
      qualifyingByReferrer.set(
        b.referredById,
        (qualifyingByReferrer.get(b.referredById) || 0) + 1
      );
    }
  }

  // A buyer is eligible when they themselves purchased (they're in `buyers`) and
  // have >= threshold direct referrals who purchased.
  const eligibleIds = buyers
    .filter((b) => (qualifyingByReferrer.get(b.id) || 0) >= t)
    .map((b) => b.id);

  return { threshold: t, payingCount: buyers.length, eligibleIds };
}

// Just the milestone number: distinct non-admin customers with a PAID order.
export async function getPayingCustomerCount(client = prisma) {
  return client.user.count({
    where: {
      role: { not: "ADMIN" },
      orders: { some: { paymentStatus: "PAID" } },
    },
  });
}

// The next draw everyone is waiting on: the active, not-yet-drawn tier with the
// SMALLEST memberThreshold (the soonest to fire). Returns community progress
// toward it (payingCount / memberThreshold), the shortfall, and a preview of the
// gifts on offer. `reached` = the milestone is already met and the draw is
// imminent (waiting on the admin to run it). Returns { payingCount, nextDraw:null }
// when there are no pending tiers. Public data — safe to expose without auth.
export async function getUpcomingDraw(client = prisma) {
  const [payingCount, tier] = await Promise.all([
    getPayingCustomerCount(client),
    client.giftTier.findFirst({
      where: { isActive: true, drawnAt: null },
      orderBy: [{ memberThreshold: "asc" }],
      include: { items: { orderBy: { sortOrder: "asc" } } },
    }),
  ]);

  if (!tier) return { payingCount, nextDraw: null };

  const remaining = Math.max(0, tier.memberThreshold - payingCount);
  const pct =
    tier.memberThreshold > 0
      ? Math.min(100, Math.round((payingCount / tier.memberThreshold) * 100))
      : 0;

  return {
    payingCount,
    nextDraw: {
      id: tier.id,
      label: tier.label || `${tier.memberThreshold} Members`,
      memberThreshold: tier.memberThreshold,
      remaining,
      pct,
      reached: payingCount >= tier.memberThreshold,
      gifts: tier.items.map((i) => ({
        name: i.name,
        imageUrl: i.imageUrl,
        quantity: i.quantity,
      })),
    },
  };
}

// LOCKED  -> milestone not yet reached.
// READY   -> milestone reached, draw not yet run (admin can run it).
// COMPLETED-> the draw has been run (drawnAt set).
export function tierStatus(tier, payingCount) {
  if (tier.drawnAt) return "COMPLETED";
  if (payingCount >= tier.memberThreshold) return "READY";
  return "LOCKED";
}

// Run a tier's draw exactly once. For each gift line we draw one random eligible
// customer (unique within this run — no one wins twice for the same tier), create
// a primary GiftWin, and, if that winner has a direct referrer, a mirror GiftWin
// for the referrer. Gift terms are snapshotted onto the wins. If the eligible
// pool is exhausted (more gift lines than eligible customers) the remaining lines
// are left unfilled. Throws on invalid state so the caller can map to HTTP codes.
export async function runTierDraw(tierId, client = prisma) {
  return client.$transaction(async (tx) => {
    const tier = await tx.giftTier.findUnique({
      where: { id: tierId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!tier) throw new Error("TIER_NOT_FOUND");
    if (tier.drawnAt) throw new Error("ALREADY_DRAWN");

    const { payingCount, eligibleIds } = await getDrawPopulation(tx);
    if (payingCount < tier.memberThreshold) throw new Error("NOT_READY");

    const pool = [...eligibleIds]; // mutated as winners are drawn out
    const results = [];

    for (const item of tier.items) {
      if (pool.length === 0) {
        results.push({ itemId: item.id, giftName: item.name, winnerId: null });
        continue;
      }

      const idx = Math.floor(Math.random() * pool.length);
      const winnerId = pool.splice(idx, 1)[0];

      const primary = await tx.giftWin.create({
        data: {
          tierId: tier.id,
          tierItemId: item.id,
          userId: winnerId,
          isReferrerMirror: false,
          giftName: item.name,
          giftImageUrl: item.imageUrl,
          quantity: item.quantity,
        },
      });

      const winner = await tx.user.findUnique({
        where: { id: winnerId },
        select: { referredById: true },
      });

      let mirrorId = null;
      if (winner?.referredById) {
        const mirror = await tx.giftWin.create({
          data: {
            tierId: tier.id,
            tierItemId: item.id,
            userId: winner.referredById,
            isReferrerMirror: true,
            relatedWinId: primary.id,
            giftName: item.name,
            giftImageUrl: item.imageUrl,
            quantity: item.quantity,
          },
        });
        mirrorId = mirror.id;
      }

      results.push({
        itemId: item.id,
        giftName: item.name,
        winnerId,
        primaryId: primary.id,
        mirrorId,
      });
    }

    await tx.giftTier.update({
      where: { id: tier.id },
      data: { drawnAt: new Date() },
    });

    const filled = results.filter((r) => r.winnerId).length;
    return { tierId: tier.id, lines: results.length, filled, results };
  });
}
