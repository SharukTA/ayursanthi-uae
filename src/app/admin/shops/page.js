"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Copy, Loader2, Store, X } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";
import { ShopReport } from "@/components/ShopReport";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import { buildShopLink, readShopReportQuery, shopReportQueryString, SHOP_TIERS } from "@/lib/shop-shared";

const FIELD =
  "w-full min-w-0 min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none transition focus:border-emerald-700";
const LABEL = "grid gap-2 min-w-0 text-xs font-semibold text-slate-800";

async function send(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied.`);
  } catch {
    toast.error("Could not copy automatically. Please select and copy it manually.");
  }
}

// A shop's code, hidden until asked for, so it is not on screen for anyone passing and
// the page does not hold every owner's code at once.
function ShopCodeRow({ shopId }) {
  const [code, setCode] = useState(null);
  const [state, setState] = useState("hidden");

  const show = async () => {
    setState("loading");
    try {
      const data = await send(`/api/admin/shops/${shopId}/code`, "GET");
      setCode(data.code);
      setState(data.code ? "shown" : "missing");
    } catch (error) {
      setState("hidden");
      toast.error(error.message);
    }
  };

  const hide = () => {
    setCode(null);
    setState("hidden");
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
      <span className="font-semibold">Shop code</span>
      {state === "shown" ? (
        <>
          <span className="min-w-0 break-all font-mono text-xs font-bold text-slate-950">{code}</span>
          <button
            type="button"
            onClick={() => copyText(code, "Shop code")}
            aria-label="Copy shop code"
            className="text-slate-500 hover:text-slate-900"
          >
            <Copy className="size-3.5" />
          </button>
          <button type="button" onClick={hide} className="font-semibold underline">
            Hide
          </button>
        </>
      ) : state === "missing" ? (
        <span>Not available. Use Replace code to set a new one.</span>
      ) : (
        <button type="button" onClick={show} disabled={state === "loading"} className="font-semibold underline">
          {state === "loading" ? "Loading..." : "Show"}
        </button>
      )}
    </div>
  );
}

// One owner asking to change their investment.
function InvestmentChangeCard({ change, onApprove, onDecline }) {
  const [busy, setBusy] = useState(false);

  const act = async (handler) => {
    setBusy(true);
    try {
      await handler();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-amber-300 bg-white p-4 shadow-sm">
      <p className="text-sm font-bold text-slate-950">{change.ownerName}</p>
      <p className="mt-1 text-xs text-slate-600 wrap-break-word">
        <a href={`tel:${change.phone}`} className="underline">{change.phone}</a> &middot;{" "}
        <a href={`mailto:${change.email}`} className="underline">{change.email}</a>
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {`${formatMoney(change.currentAed, { decimals: 0 })} (${change.currentRate}%) to `}
        <span className="font-bold text-slate-900">
          {`${formatMoney(change.requestedAed, { decimals: 0 })} (${change.requestedRate ?? "?"}%)`}
        </span>
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Requested {new Date(change.createdAt).toLocaleDateString("en-AE", { timeZone: "Asia/Dubai" })}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy}
          onClick={() => act(() => onApprove(change))}
          className="h-10 bg-emerald-700 hover:bg-emerald-800 rounded-md text-xs font-semibold"
        >
          {busy ? <Loader2 className="size-3 animate-spin mr-1.5" /> : null}
          Approve
        </Button>
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => onDecline(change))}
          className="h-10 rounded-md border border-slate-200 px-3 text-xs font-semibold text-rose-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

// One owner asking to be paid, holding the bank reference being typed for it.
function WithdrawalRequestCard({ withdrawal, onPaid, onDecline }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const act = async (handler) => {
    setBusy(true);
    try {
      await handler();
    } finally {
      setBusy(false);
    }
  };

  const overBalance = withdrawal.amount > withdrawal.available;

  return (
    <div className="rounded-md border border-amber-300 bg-white p-4 shadow-sm">
      <p className="text-sm font-bold text-slate-950">
        {withdrawal.shop.ownerName} &middot; {formatMoney(withdrawal.amount)}
      </p>
      <p className="mt-1 text-xs text-slate-600 wrap-break-word">
        <a href={`tel:${withdrawal.shop.phone}`} className="underline">{withdrawal.shop.phone}</a> &middot;{" "}
        <a href={`mailto:${withdrawal.shop.email}`} className="underline">{withdrawal.shop.email}</a>
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Available now {formatMoney(withdrawal.available)} &middot; Requested{" "}
        {new Date(withdrawal.createdAt).toLocaleDateString("en-AE", { timeZone: "Asia/Dubai" })}
      </p>
      {overBalance ? (
        <p className="mt-1 text-xs font-bold text-rose-700">
          A refund has reduced their balance below this amount since they asked.
        </p>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          act(() => onPaid(withdrawal, note, overBalance));
        }}
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className={`${LABEL} flex-1`}>
          Transfer reference
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. bank transfer reference"
            className={FIELD}
          />
        </label>
        <Button
          type="submit"
          disabled={busy}
          className="h-10 bg-emerald-700 hover:bg-emerald-800 rounded-md text-xs font-semibold"
        >
          {busy ? <Loader2 className="size-3 animate-spin mr-1.5" /> : null}
          Mark as paid
        </Button>
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => onDecline(withdrawal))}
          className="h-10 rounded-md border border-slate-200 px-3 text-xs font-semibold text-rose-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Decline
        </button>
      </form>
    </div>
  );
}

// One waiting request, holding the code being typed for it.
function JoinRequestCard({ request, onApprove, onDecline }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const act = async (handler) => {
    setBusy(true);
    try {
      await handler();
    } finally {
      setBusy(false);
    }
  };

  const tier = SHOP_TIERS.find((entry) => entry.investmentAed === request.investmentAed);

  return (
    <div className="rounded-md border border-amber-300 bg-white p-4 shadow-sm">
      <p className="text-sm font-bold text-slate-950">{request.ownerName}</p>
      <p className="mt-1 text-xs text-slate-600 wrap-break-word">
        <a href={`tel:${request.phone}`} className="underline">{request.phone}</a> &middot;{" "}
        <a href={`mailto:${request.email}`} className="underline">{request.email}</a>
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {formatMoney(request.investmentAed, { decimals: 0 })}
        {tier ? ` · ${tier.commissionRate}%` : ""} &middot; Requested{" "}
        {new Date(request.createdAt).toLocaleDateString("en-AE", { timeZone: "Asia/Dubai" })}
      </p>
      {request.referrerName ? (
        <p className="mt-1 text-xs font-semibold text-slate-800">
          Referred by {request.referrerName}
        </p>
      ) : null}
      {request.referrerSameContact ? (
        <p className="mt-1 text-xs font-bold text-rose-700">
          This applicant has the same email or mobile as {request.referrerName}, now or in the
          past. They may be referring themselves.
        </p>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          act(() => onApprove(request, code));
        }}
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className={`${LABEL} flex-1`}>
          Shop code
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="off"
            placeholder="Leave blank to generate a strong one"
            className={`${FIELD} font-mono uppercase`}
          />
        </label>
        <Button
          type="submit"
          disabled={busy}
          className="h-10 bg-emerald-700 hover:bg-emerald-800 rounded-md text-xs font-semibold"
        >
          {busy ? <Loader2 className="size-3 animate-spin mr-1.5" /> : null}
          Approve
        </Button>
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => onDecline(request))}
          className="h-10 rounded-md border border-slate-200 px-3 text-xs font-semibold text-rose-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Decline
        </button>
      </form>
    </div>
  );
}

// Access is enforced by app/admin/layout.js and by requireAdmin() on every route.
export default function AdminShopsPage() {
  const [confirm, confirmDialog] = useConfirm();
  const [shops, setShops] = useState([]);
  const [requests, setRequests] = useState([]);
  const [withdrawalMinimum, setWithdrawalMinimum] = useState(0);
  const [withdrawals, setWithdrawals] = useState([]);
  const [investmentChanges, setInvestmentChanges] = useState([]);
  const [loading, setLoading] = useState(true);

  // A code exists in readable form only in the response that created it, so this
  // stays on screen until the admin dismisses it.
  const [revealed, setRevealed] = useState(null);

  // The shop whose report is open, its report, and the payout being typed.
  const [openId, setOpenId] = useState(null);
  const [report, setReport] = useState(null);
  // Moved on by replacing a code, so a code already showing does not stay on screen.
  const [codeVersion, setCodeVersion] = useState(0);
  const [reportQuery, setReportQuery] = useState(readShopReportQuery());
  const [payout, setPayout] = useState({ amount: "", note: "" });

  const loadShops = async () => {
    const data = await send("/api/admin/shops", "GET");
    setShops(data.shops || []);
    setWithdrawalMinimum(data.withdrawalMinimum ?? 0);
  };

  const loadInvestmentChanges = async () => {
    const data = await send("/api/admin/shop-investment-changes", "GET");
    setInvestmentChanges(data.changes || []);
  };

  const loadWithdrawals = async () => {
    const data = await send("/api/admin/shop-withdrawals", "GET");
    setWithdrawals(data.withdrawals || []);
  };

  const loadRequests = async () => {
    const data = await send("/api/admin/shop-requests", "GET");
    setRequests(data.requests || []);
  };

  const loadReport = async (id, query = reportQuery) => {
    const data = await send(`/api/admin/shops/${id}${shopReportQueryString(query)}`, "GET");
    setReport(data.report);
  };

  const navigateReport = async (shop, query) => {
    setReportQuery(query);
    try {
      await loadReport(shop.id, query);
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    async function initPage() {
      try {
        await Promise.all([loadShops(), loadRequests(), loadWithdrawals(), loadInvestmentChanges()]);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    }

    initPage();
  }, []);

  const approveRequest = async (request, code) => {
    const ok = await confirm({
      title: "Approve this request?",
      description: `Only approve once you have received ${formatMoney(request.investmentAed, { decimals: 0 })} from ${request.ownerName}. This creates their shop and emails the shop code to ${request.email}.`,
      confirmLabel: "Approve",
    });
    if (!ok) return;
    try {
      const data = await send(`/api/admin/shop-requests/${request.id}`, "POST", {
        action: "approve",
        code,
      });
      if (data.emailed) {
        toast.success(`Shop created. The code was emailed to ${request.email}.`);
      } else {
        // The shop exists either way, so the code has to reach them some other way.
        setRevealed({ ownerName: request.ownerName, code: data.code, emailFailed: request.email });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      await Promise.all([loadShops(), loadRequests()]);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const declineRequest = async (request) => {
    const ok = await confirm({
      title: "Decline this request?",
      description: `${request.ownerName}'s request will be removed from this list. No email is sent, so let them know yourself. They can apply again later.`,
      confirmLabel: "Decline",
    });
    if (!ok) return;
    try {
      await send(`/api/admin/shop-requests/${request.id}`, "POST", { action: "decline" });
      await loadRequests();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const approveInvestmentChange = async (change) => {
    const raising = change.requestedAed > change.currentAed;
    const ok = await confirm({
      title: "Approve this change?",
      description: `${change.ownerName} moves to ${formatMoney(change.requestedAed, { decimals: 0 })} and ${change.requestedRate}% profit on new sales. Past sales keep their rate. ${
        raising
          ? "Only approve once you have received the extra money."
          : "This lowers their investment, so sort out any money owed back first."
      }`,
      confirmLabel: "Approve",
    });
    if (!ok) return;
    try {
      await send(`/api/admin/shop-investment-changes/${change.id}`, "POST", { action: "approve" });
      toast.success("Investment updated.");
      await Promise.all([loadShops(), loadInvestmentChanges()]);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const declineInvestmentChange = async (change) => {
    const ok = await confirm({
      title: "Decline this change?",
      description: `${change.ownerName} stays on ${formatMoney(change.currentAed, { decimals: 0 })} and ${change.currentRate}%. No email is sent, so let them know why. They can ask again.`,
      confirmLabel: "Decline",
    });
    if (!ok) return;
    try {
      await send(`/api/admin/shop-investment-changes/${change.id}`, "POST", { action: "decline" });
      await loadInvestmentChanges();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const markWithdrawalPaid = async (withdrawal, note, overBalance) => {
    const ok = await confirm({
      title: "Mark this as paid?",
      description: `Only do this after sending ${formatMoney(withdrawal.amount)} to ${withdrawal.shop.ownerName} from your business account. This records the payment and does not send any money.${
        overBalance ? ` It is more than their available ${formatMoney(withdrawal.available)}, so their balance will go negative.` : ""
      }`,
      confirmLabel: "Mark as paid",
    });
    if (!ok) return;
    try {
      await send(`/api/admin/shop-withdrawals/${withdrawal.id}`, "POST", { action: "paid", note });
      toast.success("Payment recorded.");
      await Promise.all([loadShops(), loadWithdrawals(), openId ? loadReport(openId) : null]);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const declineWithdrawal = async (withdrawal) => {
    const ok = await confirm({
      title: "Decline this request?",
      description: `${withdrawal.shop.ownerName}'s request for ${formatMoney(withdrawal.amount)} will be closed. No email is sent, so let them know why. They can ask again.`,
      confirmLabel: "Decline",
    });
    if (!ok) return;
    try {
      await send(`/api/admin/shop-withdrawals/${withdrawal.id}`, "POST", { action: "decline" });
      await Promise.all([loadWithdrawals(), openId ? loadReport(openId) : null]);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const toggleActive = async (shop) => {
    if (shop.isActive) {
      const ok = await confirm({
        title: "Deactivate this shop?",
        description: `${shop.ownerName}'s link will stop earning and their code will stop opening the shop. Past sales stay on record, and you can reactivate it at any time.`,
        confirmLabel: "Deactivate",
      });
      if (!ok) return;
    }
    try {
      await send(`/api/admin/shops/${shop.id}`, "PATCH", { isActive: !shop.isActive });
      await loadShops();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const replaceCode = async (shop) => {
    const ok = await confirm({
      title: "Replace the shop code?",
      description: `The old code stops working immediately and ${shop.ownerName} will need the new one. Their advert link keeps working.`,
      confirmLabel: "Replace code",
    });
    if (!ok) return;
    try {
      const data = await send(`/api/admin/shops/${shop.id}/code`, "POST", {});
      setRevealed({ ownerName: shop.ownerName, code: data.code });
      setCodeVersion((version) => version + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error(error.message);
    }
  };

  const toggleReport = async (shop) => {
    if (openId === shop.id) {
      setOpenId(null);
      setReport(null);
      return;
    }
    setOpenId(shop.id);
    setReport(null);
    setPayout({ amount: "", note: "" });
    const firstView = readShopReportQuery();
    setReportQuery(firstView);
    try {
      await loadReport(shop.id, firstView);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const recordPayout = async (event, shop) => {
    event.preventDefault();
    try {
      await send(`/api/admin/shops/${shop.id}/payouts`, "POST", payout);
      toast.success("Payout recorded.");
      setPayout({ amount: "", note: "" });
      await Promise.all([loadShops(), loadReport(shop.id)]);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const removePayout = async (shop, entry) => {
    const ok = await confirm({
      title: "Remove this payout?",
      description: `${formatMoney(entry.amount)} goes back into ${shop.ownerName}'s available balance, and any withdrawal request it settled shows as declined. This only corrects the record. It does not reverse a real transfer.`,
      confirmLabel: "Remove",
    });
    if (!ok) return;
    try {
      await send(`/api/admin/shops/${shop.id}/payouts/${entry.id}`, "DELETE");
      await Promise.all([loadShops(), loadReport(shop.id)]);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      <section className="bg-slate-950 py-8 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-xs font-semibold text-white/70 hover:text-white mb-2"
          >
            <ArrowLeft className="size-3" />
            Console Home
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-white">Shops</h1>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 flex-1 w-full">
        {revealed ? (
          <div className="mb-8 rounded-md border border-amber-300 bg-amber-50 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-950">
                  Shop code for {revealed.ownerName}
                </p>
                <p className="mt-2 break-all font-mono text-2xl font-extrabold text-slate-950">
                  {revealed.code}
                </p>
                {revealed.emailFailed ? (
                  <p className="mt-2 text-xs font-bold leading-5 text-rose-700">
                    The shop was created, but the email to {revealed.emailFailed} could not be sent.
                  </p>
                ) : null}
                <p className="mt-2 text-xs leading-5 text-slate-700">
                  Give this to them privately. They open their shop with this code. You can see
                  it again on their shop below.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRevealed(null)}
                aria-label="Dismiss"
                className="shrink-0 text-slate-500 hover:text-slate-900"
              >
                <X className="size-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => copyText(revealed.code, "Shop code")}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 underline"
            >
              <Copy className="size-3.5" />
              Copy code
            </button>
          </div>
        ) : null}

        {investmentChanges.length > 0 ? (
          <div className="mb-8">
            <h2 className="mb-3 text-base font-bold text-slate-950">
              Investment change requests ({investmentChanges.length})
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {investmentChanges.map((change) => (
                <InvestmentChangeCard
                  key={change.id}
                  change={change}
                  onApprove={approveInvestmentChange}
                  onDecline={declineInvestmentChange}
                />
              ))}
            </div>
          </div>
        ) : null}

        {withdrawals.length > 0 ? (
          <div className="mb-8">
            <h2 className="mb-3 text-base font-bold text-slate-950">
              Withdrawal requests ({withdrawals.length})
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {withdrawals.map((withdrawal) => (
                <WithdrawalRequestCard
                  key={withdrawal.id}
                  withdrawal={withdrawal}
                  onPaid={markWithdrawalPaid}
                  onDecline={declineWithdrawal}
                />
              ))}
            </div>
          </div>
        ) : null}

        {requests.length > 0 ? (
          <div className="mb-8">
            <h2 className="mb-3 text-base font-bold text-slate-950">
              Join requests ({requests.length})
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {requests.map((request) => (
                <JoinRequestCard
                  key={request.id}
                  request={request}
                  onApprove={approveRequest}
                  onDecline={declineRequest}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-8">
          <div className="grid gap-4 h-fit min-w-0">
            {loading ? (
              <p className="py-10 text-center text-sm font-semibold text-slate-500">Loading shops...</p>
            ) : shops.length === 0 ? (
              <div className="rounded-md border border-border bg-white p-10 text-center shadow-sm">
                <Store className="mx-auto size-8 text-slate-400" />
                <p className="mt-3 text-sm text-slate-500">No shops yet.</p>
              </div>
            ) : (
              shops.map((shop) => {
                const link = buildShopLink(window.location.origin, "/", shop.linkCode);
                return (
                  <div key={shop.id} className="rounded-md border border-border bg-white p-5 shadow-sm min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-950">
                          {shop.ownerName}
                          <span
                            className={`rounded border px-2 py-0.5 text-[9px] font-bold ${
                              shop.isActive
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-rose-50 text-rose-800 border-rose-200"
                            }`}
                          >
                            {shop.isActive ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-slate-600 break-words">
                          {shop.phone} &middot; {shop.email}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {formatMoney(shop.investmentAed, { decimals: 0 })} &middot;{" "}
                          {shop.commissionRate}%
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Referral code <span className="font-mono font-semibold">{shop.referralCode}</span>
                          {shop.referredBy ? ` · Referred by ${shop.referredBy.ownerName}` : ""}
                          {shop._count.referredShops > 0 ? ` · Referred ${shop._count.referredShops}` : ""}
                        </p>
                      </div>
                      <div className="text-xs text-slate-600 sm:text-right">
                        <p>
                          Revenue{" "}
                          <span className="font-bold text-slate-900">{formatMoney(shop.totals.sales)}</span>
                        </p>
                        {shop.totals.referralProfit > 0 ? (
                          <p className="mt-1">
                            Referral profit{" "}
                            <span className="font-bold text-slate-900">{formatMoney(shop.totals.referralProfit)}</span>
                          </p>
                        ) : null}
                        <p className="mt-1">
                          Payable{" "}
                          <span className="font-bold text-slate-900">{formatMoney(shop.totals.balance)}</span>
                        </p>
                        {shop.totals.balance < withdrawalMinimum ? (
                          <p className="mt-1 text-slate-500">
                            Below the {formatMoney(withdrawalMinimum)} minimum
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 rounded bg-slate-50 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-700">{link}</span>
                      <button
                        type="button"
                        onClick={() => copyText(link, "Link")}
                        aria-label="Copy link"
                        className="-m-1.5 shrink-0 p-1.5 text-slate-500 hover:text-slate-900"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </div>
                    <ShopCodeRow key={`${shop.id}-${codeVersion}`} shopId={shop.id} />

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
                      <button type="button" onClick={() => toggleReport(shop)} className="text-emerald-800 hover:underline">
                        {openId === shop.id ? "Hide report" : "Report & payouts"}
                      </button>
                      <button type="button" onClick={() => replaceCode(shop)} className="text-slate-700 hover:underline">
                        Replace code
                      </button>
                      <button type="button" onClick={() => toggleActive(shop)} className="text-rose-700 hover:underline">
                        {shop.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>

                    {openId === shop.id ? (
                      <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4">
                        <form
                          onSubmit={(event) => recordPayout(event, shop)}
                          className="flex flex-col gap-2 sm:flex-row sm:items-end"
                        >
                          <label className={`${LABEL} sm:w-36`}>
                            Payout amount
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              required
                              value={payout.amount}
                              onChange={(event) => setPayout((prev) => ({ ...prev, amount: event.target.value }))}
                              className={FIELD}
                            />
                          </label>
                          <label className={`${LABEL} flex-1`}>
                            Note
                            <input
                              type="text"
                              value={payout.note}
                              onChange={(event) => setPayout((prev) => ({ ...prev, note: event.target.value }))}
                              placeholder="e.g. bank transfer reference"
                              className={FIELD}
                            />
                          </label>
                          <Button
                            type="submit"
                            className="h-10 bg-emerald-700 hover:bg-emerald-800 rounded-md text-xs font-semibold"
                          >
                            Record payout
                          </Button>
                        </form>
                        {report ? (
                          <ShopReport
                            report={report}
                            onRemovePayout={(entry) => removePayout(shop, entry)}
                            onNavigate={(query) => navigateReport(shop, query)}
                          />
                        ) : (
                          <p className="text-sm text-slate-500">Loading report...</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <SiteFooter />
      {confirmDialog}
    </main>
  );
}
