// Automatic payouts — how money actually leaves the platform and reaches a
// customer's bank account with no button for them to click.
//
// WHERE THE MONEY IS. Every customer payment lands in the company's Razorpay
// account; that is the only way money arrives. Paying a referrer is therefore a
// separate OUTFLOW from that account, not a redirection of the incoming payment.
// The standard Razorpay Payments API (lib/razorpay.js) cannot send money out — it
// only collects. Sending requires RazorpayX, a different product with its own keys
// and its own funded current account.
//
// THE TWO MODES. This module works either way, and the customer's experience is
// identical (they click nothing):
//
//   RazorpayX configured   -> a real bank/UPI transfer fires automatically.
//                             WithdrawalRequest goes PENDING -> PROCESSING -> PAID,
//                             driven by the payout webhook.
//   RazorpayX NOT configured -> the WithdrawalRequest is still auto-created and the
//                             money is still held, it just waits at PENDING for an
//                             admin to pay it offline from /admin/withdrawals.
//
// So the program is fully functional today and switching on RazorpayX later is an
// env-var change, not a code change.
//
// Env (all optional; absent => fallback mode):
//   RAZORPAYX_KEY_ID          rzp_test_xxx  (falls back to RAZORPAY_KEY_ID)
//   RAZORPAYX_KEY_SECRET      xxx           (falls back to RAZORPAY_KEY_SECRET)
//   RAZORPAYX_ACCOUNT_NUMBER  2323230000000000  <- the RazorpayX *virtual account
//                             number* from the X dashboard, NOT your bank account.
//   RAZORPAYX_WEBHOOK_SECRET  xxx           (for /api/payment/razorpayx/webhook)

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const X_BASE = "https://api.razorpay.com/v1";

// Money accumulates in the wallet and is flushed out automatically once it crosses
// this line. A payout costs a per-transfer fee, so flushing every Rs. 12 commission
// the instant it lands would burn more in fees than it moves — we batch instead.
// Still zero clicks: the flush fires on its own the moment the balance qualifies.
export const MIN_AUTO_PAYOUT = 100;

const KEY_ID = () => process.env.RAZORPAYX_KEY_ID || process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = () =>
  process.env.RAZORPAYX_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;
const ACCOUNT_NUMBER = () => process.env.RAZORPAYX_ACCOUNT_NUMBER;

// RazorpayX can only be used when we have keys AND the X account number to debit.
// Without the account number there is nothing to send money FROM.
export function razorpayXConfigured() {
  return Boolean(KEY_ID() && KEY_SECRET() && ACCOUNT_NUMBER());
}

async function xFetch(path, { method = "POST", body, idempotencyKey } = {}) {
  const auth = Buffer.from(`${KEY_ID()}:${KEY_SECRET()}`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
  };
  // Guarantees a retried payout request never sends the money twice.
  if (idempotencyKey) headers["X-Payout-Idempotency"] = idempotencyKey;

  const res = await fetch(`${X_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.description || `RazorpayX ${path} failed (${res.status})`;
    const err = new Error(msg);
    err.razorpayError = data?.error;
    throw err;
  }
  return data;
}

// Human-readable destination, stored on the WithdrawalRequest so the admin list and
// the user's history read the same whether or not RazorpayX ever ran.
export function describePayoutAccount(pa) {
  if (!pa) return "";
  if (pa.method === "UPI") return pa.upiId || "";
  const acct = pa.accountNumber || "";
  const masked = acct.length > 4 ? `••••${acct.slice(-4)}` : acct;
  return [masked, pa.ifsc].filter(Boolean).join(" / ");
}

// Resolve (and cache) the RazorpayX contact + fund account for a user. These are
// stable per set of bank details — the PayoutAccount route clears them whenever the
// details change, so a stale fund account can never be paid.
async function ensureFundAccount(payoutAccount, user) {
  let { rzpContactId, rzpFundAccountId } = payoutAccount;

  if (!rzpContactId) {
    const contact = await xFetch("/contacts", {
      body: {
        name: user.name,
        email: user.email || undefined,
        contact: user.phone || undefined,
        type: "customer",
        reference_id: user.id,
      },
    });
    rzpContactId = contact.id;
  }

  if (!rzpFundAccountId) {
    const body =
      payoutAccount.method === "UPI"
        ? {
            contact_id: rzpContactId,
            account_type: "vpa",
            vpa: { address: payoutAccount.upiId },
          }
        : {
            contact_id: rzpContactId,
            account_type: "bank_account",
            bank_account: {
              name: payoutAccount.accountName,
              ifsc: payoutAccount.ifsc,
              account_number: payoutAccount.accountNumber,
            },
          };
    const fa = await xFetch("/fund_accounts", { body });
    rzpFundAccountId = fa.id;
  }

  if (
    rzpContactId !== payoutAccount.rzpContactId ||
    rzpFundAccountId !== payoutAccount.rzpFundAccountId
  ) {
    await prisma.payoutAccount.update({
      where: { id: payoutAccount.id },
      data: { rzpContactId, rzpFundAccountId },
    });
  }

  return rzpFundAccountId;
}

/**
 * DB-only half of a payout — safe to call inside a transaction.
 *
 * Sweeps the user's whole available wallet balance into a held WithdrawalRequest,
 * if and only if: they have payout details on file, (optionally) they have switched
 * automatic payouts ON, and the balance has reached `min`. Returns the request, or
 * null when there is nothing to flush (a normal, expected outcome — the money simply
 * stays in the wallet and the next attempt tries again).
 *
 * The network call that actually moves the money is deliberately NOT here: it must
 * happen after the transaction commits. Callers pair this with dispatchPayout().
 *
 * @param {object}  tx                     prisma transaction client
 * @param {string}  userId
 * @param {object}  [opts]
 * @param {number}  [opts.min]             minimum balance to flush (default MIN_AUTO_PAYOUT)
 * @param {boolean} [opts.requireEnabled]  when true (default), only flush if the user
 *                                          has turned the auto-payout toggle ON. Set
 *                                          false for a user-initiated manual withdraw.
 * @returns {Promise<object|null>} the created WithdrawalRequest, or null
 */
export async function createWithdrawalHold(
  tx,
  userId,
  { min = MIN_AUTO_PAYOUT, requireEnabled = true } = {}
) {
  const [wallet, payoutAccount] = await Promise.all([
    tx.wallet.findUnique({ where: { userId } }),
    tx.payoutAccount.findUnique({ where: { userId } }),
  ]);

  // No destination on file => nothing we can send to. Money stays in the wallet.
  if (!payoutAccount || !wallet) return null;

  // Automatic sweep only happens once the user has connected (toggled it ON). A
  // manual withdraw passes requireEnabled=false to bypass this.
  if (requireEnabled && !payoutAccount.autoPayoutEnabled) return null;

  const amount = Number(wallet.balance);
  if (!Number.isFinite(amount) || amount < min) return null;

  // Hold it: available -> pending, so a second flush can't spend the same money.
  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: { decrement: amount },
      pendingBalance: { increment: amount },
    },
  });

  return tx.withdrawalRequest.create({
    data: {
      userId,
      amount,
      status: "PENDING",
      method: payoutAccount.method,
      accountInfo: describePayoutAccount(payoutAccount),
      isAuto: requireEnabled, // system sweep => auto; manual withdraw => not auto
    },
  });
}

// Back-compat wrapper for the automatic post-commission sweep: honours the toggle
// and the batching minimum. Used by lib/referral.js.
export function createAutoWithdrawal(tx, userId) {
  return createWithdrawalHold(tx, userId, { min: MIN_AUTO_PAYOUT, requireEnabled: true });
}

/**
 * Network half — call AFTER the transaction that created the request has committed.
 * Never call inside a transaction: a slow HTTP request would hold the DB lock open.
 *
 * Hands the request to RazorpayX. On success the request goes PROCESSING and the
 * payout webhook later settles it to PAID (or REJECTED if the bank bounces it). On
 * failure the request stays PENDING with failureReason set, so the money is still
 * held and an admin can pay it manually — a failed payout never loses money.
 *
 * Best-effort by design: it swallows its own errors, because a payout problem must
 * never fail the customer's order. Returns a short status string for logging.
 */
export async function dispatchPayout(withdrawalId) {
  if (!withdrawalId) return "no_request";
  if (!razorpayXConfigured()) return "not_configured"; // admin pays it manually

  try {
    const wr = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
      include: { user: { include: { payoutAccount: true } } },
    });
    if (!wr || wr.status !== "PENDING") return "not_pending";

    const payoutAccount = wr.user.payoutAccount;
    if (!payoutAccount) return "no_account";

    const fundAccountId = await ensureFundAccount(payoutAccount, wr.user);

    const payout = await xFetch("/payouts", {
      // Keyed on our own request id: if this call is retried (redeploy, webhook
      // race, user double-save) RazorpayX returns the SAME payout instead of
      // sending the money a second time.
      idempotencyKey: wr.id,
      body: {
        account_number: ACCOUNT_NUMBER(),
        fund_account_id: fundAccountId,
        amount: Math.round(Number(wr.amount) * 100), // paise
        currency: "INR",
        mode: payoutAccount.method === "UPI" ? "UPI" : "IMPS",
        purpose: "payout",
        // If the RazorpayX balance is short, hold the payout and send it when the
        // account is topped up, rather than hard-failing it.
        queue_if_low_balance: true,
        reference_id: wr.id,
        narration: "Ayursanthi referral payout",
      },
    });

    // "processed" can come back immediately for UPI/IMPS; otherwise the webhook
    // finishes the job. settlePayout handles both, and is idempotent.
    await settlePayout({ payoutId: payout.id, status: payout.status, withdrawalId: wr.id });
    return payout.status;
  } catch (err) {
    // Money is still held at PENDING — an admin can settle it from /admin/withdrawals.
    await prisma.withdrawalRequest
      .update({
        where: { id: withdrawalId },
        data: { failureReason: String(err.message || err).slice(0, 500) },
      })
      .catch(() => {});
    console.error("Automatic payout failed:", err);
    return "failed";
  }
}

// Map a RazorpayX payout status onto our WithdrawalStatus.
//   queued/pending/processing -> in flight
//   processed                 -> money left the account, for real
//   reversed/failed/rejected/cancelled -> it did NOT leave; give it back
function mapPayoutStatus(s) {
  if (s === "processed") return "PAID";
  if (["reversed", "failed", "rejected", "cancelled"].includes(s)) return "REJECTED";
  return "PROCESSING";
}

/**
 * Apply a RazorpayX payout outcome to our books. Called both inline (from
 * dispatchPayout) and from the payout webhook, possibly more than once for the same
 * payout — so every branch is idempotent: it only acts on a request that is still
 * un-settled, and PAID/REJECTED are terminal.
 */
export async function settlePayout({ payoutId, status, withdrawalId, failureReason }) {
  const target = mapPayoutStatus(status);

  return prisma.$transaction(async (tx) => {
    const wr = withdrawalId
      ? await tx.withdrawalRequest.findUnique({ where: { id: withdrawalId } })
      : await tx.withdrawalRequest.findFirst({ where: { providerPayoutId: payoutId } });

    if (!wr) return { status: "not_found" };
    // Terminal already — a replayed webhook must not move money again.
    if (wr.status === "PAID" || wr.status === "REJECTED") {
      return { status: "already_settled" };
    }

    const amount = Number(wr.amount);
    const wallet = await tx.wallet.findUnique({ where: { userId: wr.userId } });

    if (target === "PAID" && wallet) {
      // The hold is now genuinely gone from the platform.
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { pendingBalance: { decrement: amount } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "DEBIT",
          amount,
          description: `Referral payout sent to your ${wr.method} (${wr.accountInfo})`,
          referenceType: "WITHDRAWAL",
          referenceId: wr.id,
        },
      });
    } else if (target === "REJECTED" && wallet) {
      // The bank bounced it: release the hold and give the money back so the next
      // flush (or an admin) can try again. Nothing is ever lost.
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          pendingBalance: { decrement: amount },
          balance: { increment: amount },
        },
      });
    }

    return {
      status: "settled",
      withdrawal: await tx.withdrawalRequest.update({
        where: { id: wr.id },
        data: {
          status: target,
          providerPayoutId: payoutId || wr.providerPayoutId,
          failureReason: failureReason ?? wr.failureReason,
          processedAt: target === "PROCESSING" ? null : new Date(),
        },
      }),
    };
  });
}

/**
 * Flush a user's wallet balance to their payout account right now: the whole
 * create-then-dispatch cycle in one call.
 *
 * Called at the two moments a waiting balance becomes deliverable: when the user
 * CONNECTS (toggles automatic payouts ON), and when they ask for a one-time manual
 * withdraw (opts.requireEnabled=false). Returns null when there is nothing to send.
 *
 * @param {string} userId
 * @param {object} [opts] forwarded to createWithdrawalHold (min, requireEnabled)
 */
export async function flushWalletToPayout(userId, opts = {}) {
  const wr = await prisma.$transaction((tx) => createWithdrawalHold(tx, userId, opts));
  if (!wr) return null;
  await dispatchPayout(wr.id);
  return wr;
}

/** Verify a RazorpayX webhook. Its secret is separate from the Payments webhook's. */
export function verifyPayoutWebhookSignature({ body, signature }) {
  const secret = process.env.RAZORPAYX_WEBHOOK_SECRET;
  if (!secret || !body || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
