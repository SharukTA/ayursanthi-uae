import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  flushWalletToPayout,
  razorpayXConfigured,
  MIN_AUTO_PAYOUT,
} from "@/lib/payouts";
import { MIN_WITHDRAWAL_AMOUNT } from "@/lib/wallet";

export const runtime = "nodejs";

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_RE = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

/**
 * The user's payout destination — where their post-milestone referral commission is
 * automatically sent.
 *
 * This is the answer to "do they need to add bank details?": yes. Commission is
 * always credited to the wallet first, but with no account on file there is nowhere
 * to send it, so it just sits there. Saving details here makes it deliverable, and
 * PUT immediately flushes whatever has piled up — the user presses "Save", not
 * "Withdraw".
 */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const account = await prisma.payoutAccount.findUnique({
    where: { userId: session.userId },
    // Never echo the full account number back to the browser.
    select: {
      method: true,
      upiId: true,
      accountName: true,
      accountNumber: true,
      ifsc: true,
      autoPayoutEnabled: true,
      updatedAt: true,
    },
  });

  return Response.json({
    account: account
      ? {
          ...account,
          accountNumber: account.accountNumber
            ? `••••${account.accountNumber.slice(-4)}`
            : null,
        }
      : null,
    // Whether the PLATFORM can send real-time transfers (RazorpayX). Distinct from
    // the user's own autoPayoutEnabled toggle above: off => an enabled payout is
    // still created but an admin settles it by hand.
    systemAutoPayout: razorpayXConfigured(),
    minAutoPayout: MIN_AUTO_PAYOUT,
  });
}

export async function PUT(request) {
  const session = await getSession();
  if (!session) return Response.json({ message: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid request body." }, { status: 400 });
  }

  const method = String(body.method || "").toUpperCase();
  if (!["UPI", "BANK"].includes(method)) {
    return Response.json({ message: "Choose UPI or Bank account." }, { status: 400 });
  }

  const data = { method, upiId: null, accountName: null, accountNumber: null, ifsc: null };

  if (method === "UPI") {
    const upiId = String(body.upiId || "").trim();
    if (!UPI_RE.test(upiId)) {
      return Response.json(
        { message: "Enter a valid UPI ID (e.g. name@bank)." },
        { status: 400 }
      );
    }
    data.upiId = upiId;
  } else {
    const accountName = String(body.accountName || "").trim();
    const accountNumber = String(body.accountNumber || "").replace(/\s/g, "");
    const ifsc = String(body.ifsc || "").trim().toUpperCase();

    if (accountName.length < 2) {
      return Response.json(
        { message: "Enter the account holder's name exactly as it appears on the bank account." },
        { status: 400 }
      );
    }
    if (!/^\d{6,18}$/.test(accountNumber)) {
      return Response.json({ message: "Enter a valid bank account number." }, { status: 400 });
    }
    if (!IFSC_RE.test(ifsc)) {
      return Response.json(
        { message: "Enter a valid IFSC code (e.g. HDFC0001234)." },
        { status: 400 }
      );
    }
    Object.assign(data, { accountName, accountNumber, ifsc });
  }

  // Details changed => the cached RazorpayX contact/fund-account no longer describe
  // this destination. Clearing them forces a fresh one on the next payout, so money
  // can never be sent to an account the user has already replaced. The auto-payout
  // toggle is deliberately NOT set here: saving a destination and CONNECTING it are
  // two separate steps (see PATCH). A new account starts with payouts OFF.
  await prisma.payoutAccount.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, ...data },
    update: { ...data, rzpContactId: null, rzpFundAccountId: null },
  });

  // If automatic payouts were already switched on (they edited an existing, connected
  // account), a waiting balance should still go out to the new destination.
  const existing = await prisma.payoutAccount.findUnique({
    where: { userId: session.userId },
    select: { autoPayoutEnabled: true },
  });
  let flushed = null;
  if (existing?.autoPayoutEnabled) {
    try {
      flushed = await flushWalletToPayout(session.userId, { requireEnabled: true });
    } catch (e) {
      console.error("Wallet flush after payout-account save failed:", e);
    }
  }

  return Response.json({
    success: true,
    message: flushed
      ? `Payout details saved. Rs. ${Number(flushed.amount).toLocaleString("en-IN")} is on its way to your ${method === "UPI" ? "UPI ID" : "bank account"}.`
      : "Payout details saved. Turn on automatic payouts below to have your earnings sent here.",
    flushedAmount: flushed ? Number(flushed.amount) : 0,
  });
}

/**
 * PATCH — connect / disconnect automatic payouts, or make a one-time manual withdraw.
 *
 * Body is one of:
 *   { autoPayoutEnabled: true }   -> connect: turn the toggle ON and immediately send
 *                                    any qualifying balance to the saved account.
 *   { autoPayoutEnabled: false }  -> disconnect: future commission just waits in the
 *                                    wallet; nothing is sent automatically.
 *   { action: "withdraw_now" }    -> manual fallback: send the current balance out
 *                                    once, regardless of the toggle.
 */
export async function PATCH(request) {
  const session = await getSession();
  if (!session) return Response.json({ message: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid request body." }, { status: 400 });
  }

  const account = await prisma.payoutAccount.findUnique({
    where: { userId: session.userId },
  });
  if (!account) {
    return Response.json(
      { message: "Add your bank or UPI details before connecting payouts." },
      { status: 400 }
    );
  }

  // ── Manual one-time withdraw (the fallback when the toggle is off) ────────────
  if (body.action === "withdraw_now") {
    let flushed = null;
    try {
      flushed = await flushWalletToPayout(session.userId, {
        requireEnabled: false,
        min: MIN_WITHDRAWAL_AMOUNT,
      });
    } catch (e) {
      console.error("Manual withdraw failed:", e);
      return Response.json({ message: "Could not process the withdrawal." }, { status: 500 });
    }
    if (!flushed) {
      return Response.json(
        { message: `You need at least Rs. ${MIN_WITHDRAWAL_AMOUNT} in your wallet to withdraw.` },
        { status: 400 }
      );
    }
    return Response.json({
      success: true,
      message: `Rs. ${Number(flushed.amount).toLocaleString("en-IN")} is on its way to your ${account.method === "UPI" ? "UPI ID" : "bank account"}.`,
      flushedAmount: Number(flushed.amount),
    });
  }

  // ── Connect / disconnect the auto-payout toggle ──────────────────────────────
  if (typeof body.autoPayoutEnabled === "boolean") {
    await prisma.payoutAccount.update({
      where: { userId: session.userId },
      data: { autoPayoutEnabled: body.autoPayoutEnabled },
    });

    // Turning it on is also the moment to send whatever has piled up.
    let flushed = null;
    if (body.autoPayoutEnabled) {
      try {
        flushed = await flushWalletToPayout(session.userId, { requireEnabled: true });
      } catch (e) {
        console.error("Flush on connect failed:", e);
      }
    }

    return Response.json({
      success: true,
      autoPayoutEnabled: body.autoPayoutEnabled,
      message: body.autoPayoutEnabled
        ? flushed
          ? `Automatic payouts connected. Rs. ${Number(flushed.amount).toLocaleString("en-IN")} is on its way to your account.`
          : "Automatic payouts connected. Future earnings will be sent here automatically."
        : "Automatic payouts turned off. Your earnings will stay in your wallet.",
      flushedAmount: flushed ? Number(flushed.amount) : 0,
    });
  }

  return Response.json({ message: "Nothing to update." }, { status: 400 });
}
