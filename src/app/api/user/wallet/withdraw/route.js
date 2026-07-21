import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { MIN_WITHDRAWAL_AMOUNT } from "@/lib/wallet";
import { getMilestoneThreshold } from "@/lib/referral";
import { countQualifyingReferrals } from "@/lib/gift-draws";

export const runtime = "nodejs";

/**
 * Manually request a withdrawal — the FALLBACK path.
 *
 * The normal path needs no request at all: once a user is past the milestone and has
 * payout details saved, commission is swept to their bank automatically. This
 * endpoint is for the leftovers — voucher credit, or a balance they'd rather have
 * paid by hand than save a bank account for. See lib/wallet.js.
 *
 * Eligibility is the referral MILESTONE, not a raw headcount: a user who hasn't
 * crossed it has no referral money to withdraw by definition, because the company
 * retained all of it (lib/referral.js).
 *
 * On success the amount moves from available balance into pending balance (a hold),
 * so the same money can never be requested twice.
 */
export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid request body." }, { status: 400 });
  }

  const amount = Math.round(Number(body.amount) * 100) / 100;
  const method = String(body.method || "").toUpperCase();
  const accountInfo = String(body.accountInfo || "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ message: "Enter a valid withdrawal amount." }, { status: 400 });
  }
  if (amount < MIN_WITHDRAWAL_AMOUNT) {
    return Response.json(
      { message: `The minimum withdrawal amount is Rs. ${MIN_WITHDRAWAL_AMOUNT}.` },
      { status: 400 }
    );
  }
  if (!["UPI", "BANK"].includes(method)) {
    return Response.json({ message: "Choose a payout method (UPI or Bank)." }, { status: 400 });
  }
  if (accountInfo.length < 5) {
    return Response.json(
      { message: "Enter your UPI ID or bank account details." },
      { status: 400 }
    );
  }

  // Eligibility gate: the referral milestone must already be latched.
  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { referralMilestoneAt: true },
  });
  if (!me?.referralMilestoneAt) {
    const [threshold, qualifying] = await Promise.all([
      getMilestoneThreshold(),
      countQualifyingReferrals(prisma, session.userId),
    ]);
    return Response.json(
      {
        message: `You need ${threshold} direct referrals who have each placed an order to unlock earnings. You currently have ${qualifying}.`,
      },
      { status: 403 }
    );
  }

  try {
    const withdrawal = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: session.userId } });
      if (!wallet) throw new Error("WALLET_NOT_FOUND");
      if (Number(wallet.balance) < amount) throw new Error("INSUFFICIENT_BALANCE");

      // Hold the amount: available balance -> pending balance.
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: amount },
          pendingBalance: { increment: amount },
        },
      });

      return tx.withdrawalRequest.create({
        data: { userId: session.userId, amount, method, accountInfo, status: "PENDING" },
      });
    });

    return Response.json(
      { success: true, message: "Withdrawal request submitted.", withdrawal },
      { status: 201 }
    );
  } catch (e) {
    if (e.message === "INSUFFICIENT_BALANCE") {
      return Response.json(
        { message: "Withdrawal amount exceeds your available balance." },
        { status: 400 }
      );
    }
    if (e.message === "WALLET_NOT_FOUND") {
      return Response.json({ message: "Wallet not found." }, { status: 404 });
    }
    console.error("Withdrawal request failed:", e);
    return Response.json(
      { message: "Failed to submit withdrawal request." },
      { status: 500 }
    );
  }
}
