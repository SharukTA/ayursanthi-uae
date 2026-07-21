import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  countQualifyingReferrals,
  getReferralThreshold,
  hasPurchased,
} from "@/lib/gift-draws";

export const runtime = "nodejs";

// GET /api/gifts/me — the current user's gift-draw status, used by the homepage
// gift block, the /gifts page, and the dashboard rewards page. Shapes:
//   logged out -> 401 { loggedIn: false }
//   admin      -> { loggedIn: true, isAdmin: true }
//   customer   -> { purchased, qualifyingReferrals, threshold, eligible, wins,
//                   referralReward }
//
// `referralReward` is the free product granted for reaching the referral milestone
// (see lib/referral.js). It is not drawn — it is guaranteed the moment they cross —
// but it ships through the same claim-an-address flow as a gift win, so it rides
// along here rather than in a parallel endpoint.
export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ loggedIn: false }, { status: 401 });
  }

  // Admins manage the program; they don't take part in the draws.
  if (session.role === "ADMIN") {
    return Response.json({ loggedIn: true, isAdmin: true });
  }

  try {
    const threshold = await getReferralThreshold();
    const [purchased, qualifyingReferrals, wins, me, referralReward] = await Promise.all([
      hasPurchased(prisma, session.userId),
      countQualifyingReferrals(prisma, session.userId),
      prisma.giftWin.findMany({
        where: { userId: session.userId, status: { not: "REJECTED" } },
        orderBy: { createdAt: "desc" },
        include: { tier: { select: { label: true, memberThreshold: true } } },
      }),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { referralMilestoneAt: true },
      }),
      prisma.referralReward.findUnique({ where: { userId: session.userId } }),
    ]);

    return Response.json({
      loggedIn: true,
      isAdmin: false,
      purchased,
      qualifyingReferrals,
      threshold,
      eligible: purchased && qualifyingReferrals >= threshold,
      milestoneReached: Boolean(me?.referralMilestoneAt),
      milestoneAt: me?.referralMilestoneAt || null,
      referralReward: referralReward
        ? {
            id: referralReward.id,
            productName: referralReward.productName,
            productImageUrl: referralReward.productImageUrl,
            quantity: referralReward.quantity,
            status: referralReward.status,
            adminNote: referralReward.adminNote,
            addressSnapshot: referralReward.addressSnapshot,
            createdAt: referralReward.createdAt,
          }
        : null,
      wins: wins.map((w) => ({
        id: w.id,
        giftName: w.giftName,
        giftImageUrl: w.giftImageUrl,
        quantity: w.quantity,
        status: w.status,
        isReferrerMirror: w.isReferrerMirror,
        adminNote: w.adminNote,
        addressSnapshot: w.addressSnapshot,
        tierLabel:
          w.tier?.label ||
          (w.tier ? `${w.tier.memberThreshold} members` : null),
        createdAt: w.createdAt,
      })),
    });
  } catch (e) {
    console.error(e);
    return Response.json(
      { message: "Failed to load your gift status." },
      { status: 503 }
    );
  }
}
