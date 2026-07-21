import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { MIN_WITHDRAWAL_AMOUNT } from "@/lib/wallet";
import { getMilestoneThreshold } from "@/lib/referral";
import { countQualifyingReferrals } from "@/lib/gift-draws";
import { razorpayXConfigured, MIN_AUTO_PAYOUT } from "@/lib/payouts";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [wallet, me, threshold, qualifyingReferrals, withdrawals, retained] =
    await Promise.all([
      prisma.wallet.findUnique({
        where: { userId: session.userId },
        include: { transactions: { orderBy: { createdAt: "desc" } } },
      }),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { referralMilestoneAt: true, payoutAccount: true },
      }),
      getMilestoneThreshold(),
      // Only referrals who actually PAID for an order count toward the milestone —
      // the same rule the gift draws use, so the two never disagree.
      countQualifyingReferrals(prisma, session.userId),
      prisma.withdrawalRequest.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
      }),
      // What the company retained from this user's referrals while they were still
      // climbing — shown as progress, not as a balance they can spend.
      prisma.companyEarning.aggregate({
        where: { referrerId: session.userId },
        _sum: { amount: true },
      }),
    ]);

  const milestoneReached = Boolean(me?.referralMilestoneAt);
  const hasPayoutAccount = Boolean(me?.payoutAccount);

  return Response.json({
    wallet: wallet || null,
    withdrawals,

    // Milestone state — drives the whole wallet page.
    milestoneReached,
    milestoneAt: me?.referralMilestoneAt || null,
    milestoneThreshold: threshold,
    qualifyingReferrals,
    referralsLeft: Math.max(0, threshold - qualifyingReferrals),
    // Pre-milestone commission the company kept. Motivational, not spendable.
    retainedByCompany: Number(retained._sum.amount || 0),

    // Payout state.
    hasPayoutAccount,
    systemAutoPayout: razorpayXConfigured(),
    minAutoPayout: MIN_AUTO_PAYOUT,
    minWithdrawalAmount: MIN_WITHDRAWAL_AMOUNT,

    // Manual withdrawal is a fallback now: it exists for anyone past the milestone
    // who has money sitting in the wallet and would rather be paid by hand than save
    // payout details (with details saved, the money leaves on its own).
    canWithdraw: milestoneReached,
  });
}
