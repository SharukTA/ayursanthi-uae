"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  TrendingUp,
  AlertCircle,
  Lock,
  Banknote,
  CheckCircle2,
  XCircle,
  Zap,
  Building2,
  Loader2,
  Info,
  Gift,
} from "lucide-react";
import { FadeIn, PageReveal, Stagger, StaggerItem } from "@/components/Animated";

// "11th", "21st", "22nd", "3rd" ... for the "from your Nth referral onwards" copy.
function ordinalSuffix(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export default function WalletPage() {
  const [data, setData] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  // Payout details form
  const [method, setMethod] = useState("UPI");
  const [upiId, setUpiId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  // Connect toggle / manual withdraw
  const [busyAction, setBusyAction] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const load = useCallback(() => {
    return Promise.all([
      fetch("/api/user/wallet").then((r) => r.json()),
      fetch("/api/user/payout-account").then((r) => r.json()),
    ])
      .then(([w, a]) => {
        setData(w);
        setAccount(a?.account || null);
        if (a?.account) setMethod(a.account.method);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <p className="animate-pulse text-sm font-medium text-white">Loading wallet...</p>
      </div>
    );
  }

  const wallet = data?.wallet;
  const balance = Number(wallet?.balance || 0);
  const pending = Number(wallet?.pendingBalance || 0);
  const transactions = wallet?.transactions || [];
  const withdrawals = data?.withdrawals || [];

  const milestoneReached = Boolean(data?.milestoneReached);
  const threshold = data?.milestoneThreshold ?? 10;
  const qualifying = data?.qualifyingReferrals || 0;
  const referralsLeft = data?.referralsLeft ?? Math.max(0, threshold - qualifying);
  const retained = Number(data?.retainedByCompany || 0);
  const hasPayoutAccount = Boolean(data?.hasPayoutAccount);
  const minAutoPayout = data?.minAutoPayout ?? 100;
  const minWithdraw = data?.minWithdrawalAmount ?? 100;
  const autoPayoutOn = Boolean(account?.autoPayoutEnabled);

  const credits = transactions.filter((t) => t.type === "CREDIT");
  const debits = transactions.filter((t) => t.type === "DEBIT");
  const totalEarned = credits.reduce((acc, t) => acc + Number(t.amount), 0);
  const totalDebited = debits.reduce((acc, t) => acc + Number(t.amount), 0);

  const filtered =
    filter === "ALL" ? transactions : transactions.filter((t) => t.type === filter);

  async function handleSavePayout(e) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setSaving(true);
    try {
      const res = await fetch("/api/user/payout-account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, upiId, accountName, accountNumber, ifsc }),
      });
      const result = await res.json();
      if (!res.ok) {
        setFormError(result.message || "Failed to save payout details.");
      } else {
        setFormSuccess(result.message);
        setAccountNumber("");
        await load();
      }
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function patchPayout(payload, fallbackErr) {
    setActionMsg("");
    setBusyAction(true);
    try {
      const res = await fetch("/api/user/payout-account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        setActionMsg(result.message || fallbackErr);
      } else {
        setActionMsg(result.message || "");
        await load();
      }
    } catch {
      setActionMsg("Network error. Please try again.");
    } finally {
      setBusyAction(false);
    }
  }

  const handleToggleAuto = (next) =>
    patchPayout({ autoPayoutEnabled: next }, "Could not update automatic payouts.");
  const handleWithdrawNow = () =>
    patchPayout({ action: "withdraw_now" }, "Could not process the withdrawal.");

  const statusStyles = {
    PENDING: { cls: "bg-amber-100 text-amber-700", Icon: Clock },
    PROCESSING: { cls: "bg-sky-100 text-sky-700", Icon: Loader2 },
    PAID: { cls: "bg-[#232f3e] text-white", Icon: CheckCircle2 },
    REJECTED: { cls: "bg-rose-100 text-rose-700", Icon: XCircle },
  };

  return (
    <div className="flex flex-col gap-6">
      <PageReveal>
        <h1 className="text-2xl font-bold text-white">Wallet</h1>
        <p className="mt-1 text-sm text-[#3f4545]">
          Track your earnings, commissions, and transaction history.
        </p>
      </PageReveal>

      {/* How referral earnings work — always shown so the rule is never a surprise */}
      <FadeIn className="rounded-md border-2 border-[#d5d9d9] bg-[#232f3e]/[0.04] p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-5 shrink-0 text-[#0f1111]" />
          <div>
            <p className="text-sm font-bold text-[#0f1111]">
              How your referral earnings work
            </p>
            <p className="mt-1 text-xs leading-5 text-[#3f4545]">
              Commission from your first <strong>{threshold}</strong> referrals is
              credited to the <strong>company account</strong>. From your{" "}
              <strong>{threshold + 1}{ordinalSuffix(threshold + 1)} referral onwards</strong>,
              every commission is <strong>yours</strong> — added to your wallet and sent to
              your bank account automatically.
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-[#3f4545]">
              <Gift className="mt-0.5 size-4 shrink-0 text-[#0f1111]" />
              <span>
                The moment you reach <strong>{threshold} referrals</strong> you are also
                gifted a <strong>free product</strong> and an{" "}
                <strong>entry to the gift event</strong>.
              </span>
            </p>
          </div>
        </div>
      </FadeIn>

      {/* Balance cards */}
      <Stagger className="grid gap-4 sm:grid-cols-3">
        <StaggerItem>
          <div className="rounded-md border-2 border-[#d5d9d9] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#565959]">
                Available Balance
              </p>
              <Wallet className="size-4 text-[#0f1111]" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-[#0f1111]">
              Rs. {balance.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-[#565959]">
              {milestoneReached && hasPayoutAccount && autoPayoutOn
                ? `Sent to your ${account?.method === "UPI" ? "UPI ID" : "bank"} automatically`
                : "Ready to use or withdraw"}
            </p>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="rounded-md border-2 border-[#d5d9d9] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#565959]">
                Pending Balance
              </p>
              <AlertCircle className="size-4 text-[#0f1111]" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-[#0f1111]">
              Rs. {pending.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-[#565959]">On its way to your account</p>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="rounded-md border-2 border-[#d5d9d9] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#565959]">
                Total Earned
              </p>
              <TrendingUp className="size-4 text-[#0f1111]" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-[#0f1111]">
              Rs. {totalEarned.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-[#565959]">Lifetime commissions</p>
          </div>
        </StaggerItem>
      </Stagger>

      {/* Earnings status: locked (still climbing) vs unlocked (auto-payout) */}
      <FadeIn className="rounded-md border border-border bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#d5d9d9] p-5">
          {milestoneReached ? (
            <Zap className="size-4 text-[#0f1111]" />
          ) : (
            <Lock className="size-4 text-[#0f1111]" />
          )}
          <h2 className="text-sm font-bold text-[#0f1111]">
            {milestoneReached ? "Automatic Payouts" : "Unlock Your Earnings"}
          </h2>
        </div>

        {!milestoneReached ? (
          /* ── Still climbing: commission is retained by Ayursanthi ───────────── */
          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-start gap-3 rounded-md bg-[#f8fafc] p-4">
              <Building2 className="mt-0.5 size-5 shrink-0 text-[#565959]" />
              <div>
                <p className="text-sm font-bold text-[#0f1111]">
                  Your first {threshold} referrals build your milestone
                </p>
                <p className="mt-1 text-xs text-[#565959]">
                  Commission from your first <strong>{threshold}</strong> referrals is
                  credited to the <strong>company account</strong>. Get{" "}
                  <strong>
                    {referralsLeft} more {referralsLeft === 1 ? "person" : "people"}
                  </strong>{" "}
                  to place an order and you unlock a{" "}
                  <strong>free product</strong>, <strong>entry to the gift event</strong>,
                  and from then on <strong>every commission is paid straight to your
                  bank account</strong> — automatically.
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-[#0f1111]">
                <span>Referrals who have ordered</span>
                <span>
                  {qualifying} / {threshold}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#f7fafa]">
                <div
                  className="h-full rounded-full bg-[#232f3e] transition-all"
                  style={{ width: `${Math.min(100, (qualifying / threshold) * 100)}%` }}
                />
              </div>
            </div>

            {retained > 0 && (
              <p className="text-[11px] text-[#565959]">
                Rs. {retained.toLocaleString()} in commission has gone toward your
                milestone so far.
              </p>
            )}
          </div>
        ) : (
          /* ── Past the milestone: money leaves on its own ─────────────────────── */
          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-2 rounded-md bg-[#f7fafa] px-3 py-2 text-xs font-semibold text-[#0f1111]">
              <CheckCircle2 className="size-4 shrink-0" />
              Milestone reached ({qualifying} referrals). Every commission from here is
              yours.
            </div>

            <p className="text-xs text-[#565959]">
              {!hasPayoutAccount ? (
                <>
                  <strong>Add your payout details to get paid.</strong> Your commission is
                  safe in your wallet, but we have nowhere to send it until you add a bank
                  account or UPI ID below.
                </>
              ) : autoPayoutOn ? (
                <>
                  <strong>Automatic payouts are on.</strong> Your balance is sent to the
                  account below on its own once it reaches Rs.{" "}
                  {minAutoPayout.toLocaleString()} — nothing to click.
                </>
              ) : (
                <>
                  Your details are saved. <strong>Turn on automatic payouts</strong> to
                  connect the account and have your earnings sent there on their own, or
                  withdraw what you have now by hand.
                </>
              )}
            </p>

            <form onSubmit={handleSavePayout} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-xs font-semibold text-[#0f1111] sm:max-w-xs">
                Payout method
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="rounded-md border border-[#d5d9d9] px-3 py-2 text-sm font-medium text-[#0f1111] outline-none focus:border-[#007185]"
                >
                  <option value="UPI">UPI</option>
                  <option value="BANK">Bank account</option>
                </select>
              </label>

              {method === "UPI" ? (
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#0f1111] sm:max-w-xs">
                  UPI ID
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder={account?.upiId || "name@bank"}
                    className="rounded-md border border-[#d5d9d9] px-3 py-2 text-sm font-medium text-[#0f1111] outline-none focus:border-[#007185]"
                    required
                  />
                </label>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-[#0f1111]">
                    Account holder name
                    <input
                      type="text"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder={account?.accountName || "As on your bank account"}
                      className="rounded-md border border-[#d5d9d9] px-3 py-2 text-sm font-medium text-[#0f1111] outline-none focus:border-[#007185]"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-[#0f1111]">
                    Account number
                    <input
                      type="text"
                      inputMode="numeric"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder={account?.accountNumber || "Bank account number"}
                      className="rounded-md border border-[#d5d9d9] px-3 py-2 text-sm font-medium text-[#0f1111] outline-none focus:border-[#007185]"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-[#0f1111]">
                    IFSC code
                    <input
                      type="text"
                      value={ifsc}
                      onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                      placeholder={account?.ifsc || "HDFC0001234"}
                      className="rounded-md border border-[#d5d9d9] px-3 py-2 text-sm font-medium text-[#0f1111] outline-none focus:border-[#007185]"
                      required
                    />
                  </label>
                </div>
              )}

              {formError && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                  <AlertCircle className="size-3.5" /> {formError}
                </p>
              )}
              {formSuccess && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[#0f1111]">
                  <CheckCircle2 className="size-3.5" /> {formSuccess}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="self-start rounded-md bg-[#232f3e] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : hasPayoutAccount
                    ? "Update payout details"
                    : "Save payout details"}
              </button>
            </form>

            {/* Connect toggle + manual withdraw — only once a destination is saved */}
            {hasPayoutAccount && (
              <div className="flex flex-col gap-3 rounded-md border border-[#d5d9d9] bg-[#f8fafc] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#0f1111]">Automatic payouts</p>
                    <p className="mt-0.5 text-[11px] text-[#565959]">
                      {autoPayoutOn
                        ? `Connected — earnings are sent to your ${account?.method === "UPI" ? "UPI ID" : "bank account"} automatically.`
                        : "Off — your earnings stay in your wallet until you connect."}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoPayoutOn}
                    disabled={busyAction}
                    onClick={() => handleToggleAuto(!autoPayoutOn)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                      autoPayoutOn ? "bg-[#232f3e]" : "bg-[#eaeded]"
                    }`}
                  >
                    <span
                      className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                        autoPayoutOn ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Manual fallback: pay out now without switching auto on */}
                {!autoPayoutOn && balance >= minWithdraw && (
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={handleWithdrawNow}
                    className="self-start rounded-md border border-[#adb1b8] px-4 py-2 text-xs font-bold text-[#0f1111] transition-colors hover:bg-[#232f3e] hover:text-white disabled:opacity-50"
                  >
                    {busyAction
                      ? "Processing..."
                      : `Withdraw Rs. ${balance.toLocaleString()} now`}
                  </button>
                )}

                {actionMsg && (
                  <p className="text-xs font-semibold text-[#0f1111]">{actionMsg}</p>
                )}
              </div>
            )}
          </div>
        )}
      </FadeIn>

      {/* Payout history */}
      {withdrawals.length > 0 && (
        <FadeIn className="rounded-md border border-border bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#d5d9d9] p-5">
            <Banknote className="size-4 text-[#0f1111]" />
            <h2 className="text-sm font-bold text-[#0f1111]">Payouts</h2>
          </div>
          <div className="divide-y divide-[#d5d9d9]">
            {withdrawals.map((w) => {
              const s = statusStyles[w.status] || statusStyles.PENDING;
              const StatusIcon = s.Icon;
              return (
                <div key={w.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#0f1111]">
                      Rs. {Number(w.amount).toLocaleString()}
                      <span className="ml-2 text-[11px] font-medium text-[#565959]">
                        via {w.method}
                        {w.isAuto ? " · automatic" : ""}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#565959]">
                      {new Date(w.createdAt).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                      {" · "}
                      {w.accountInfo}
                    </p>
                    {(w.adminNote || w.failureReason) && (
                      <p className="mt-0.5 text-[11px] italic text-[#565959]">
                        {w.adminNote || w.failureReason}
                      </p>
                    )}
                  </div>
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${s.cls}`}
                  >
                    <StatusIcon
                      className={`size-3 ${w.status === "PROCESSING" ? "animate-spin" : ""}`}
                    />
                    {w.status}
                  </span>
                </div>
              );
            })}
          </div>
        </FadeIn>
      )}

      {/* Transaction history */}
      <FadeIn className="rounded-md border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#d5d9d9] p-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#0f1111]">
            <Clock className="size-4 text-[#0f1111]" />
            Transaction History
            <span className="ml-1 rounded bg-[#232f3e] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {filtered.length}
            </span>
          </h2>

          <div className="flex gap-1 rounded-md border border-[#d5d9d9] p-0.5 text-xs font-semibold">
            {["ALL", "CREDIT", "DEBIT"].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`rounded px-3 py-1.5 transition-colors ${
                  filter === tab
                    ? "bg-[#232f3e] text-white shadow-sm"
                    : "text-[#0f1111] hover:bg-[#f8fafc]"
                }`}
              >
                {tab === "ALL" ? "All" : tab === "CREDIT" ? "Credits" : "Debits"}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Wallet className="mx-auto size-12 text-[#aab7b8]" />
            <p className="mt-3 text-sm font-medium text-[#0f1111]">No transactions found.</p>
            <p className="mt-1 text-xs text-[#565959]">
              {milestoneReached
                ? "Referral commissions from your network will appear here."
                : `Commission starts landing here once you pass ${threshold} referrals.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#d5d9d9]">
            {filtered.map((tx) => {
              const isCredit = tx.type === "CREDIT";
              return (
                <div key={tx.id} className="flex items-start gap-4 px-5 py-4">
                  <span
                    className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${
                      isCredit ? "bg-[#232f3e] text-white" : "bg-rose-600 text-white"
                    }`}
                  >
                    {isCredit ? (
                      <ArrowUpRight className="size-4" />
                    ) : (
                      <ArrowDownRight className="size-4" />
                    )}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#0f1111] leading-5">
                      {tx.description || tx.type}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-[10px] text-[#565959]">
                        {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                        {" · "}
                        {new Date(tx.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {tx.referenceType && (
                        <span className="rounded bg-[#f8fafc] border border-[#d5d9d9] px-1.5 py-0.5 text-[9px] font-bold text-[#0f1111]">
                          {tx.referenceType}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`shrink-0 text-sm font-extrabold ${
                      isCredit ? "text-[#0f1111]" : "text-rose-600"
                    }`}
                  >
                    {isCredit ? "+" : "-"}Rs. {Number(tx.amount).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {transactions.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-[#d5d9d9] bg-[#f8fafc] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565959]">
              Summary
            </span>
            <div className="flex gap-5 text-xs font-semibold">
              <span className="text-[#0f1111]">
                Total Credits: Rs. {totalEarned.toLocaleString()}
              </span>
              <span className="text-rose-600">
                Total Debits: Rs. {totalDebited.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </FadeIn>
    </div>
  );
}
