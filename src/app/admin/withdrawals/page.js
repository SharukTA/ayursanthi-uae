"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Banknote,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useConfirm } from "@/components/ConfirmDialog";

const STATUS_STYLES = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  PAID: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 border-rose-200",
};

export default function AdminWithdrawalsPage() {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [authChecked, setAuthChecked] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [filter, setFilter] = useState("PENDING");

  useEffect(() => {
    async function initPage() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (!sessionData.loggedIn || sessionData.session.role !== "ADMIN") {
          toast.error("Unauthorized administrative access.");
          router.push("/login");
          return;
        }
        setAuthChecked(true);
        await fetchWithdrawals();
      } catch (e) {
        console.error("Initial load failure:", e);
      } finally {
        setLoading(false);
      }
    }
    initPage();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      const res = await fetch("/api/admin/withdrawals");
      const data = await res.json();
      setWithdrawals(data.withdrawals || []);
    } catch (e) {
      toast.error("Failed to load withdrawal requests.");
    }
  };

  const resolve = async (id, action) => {
    const ok = await confirm({
      title: action === "PAID" ? "Mark as Paid?" : "Reject request?",
      description:
        action === "PAID"
          ? "Confirm you have sent the money offline. This clears the hold and records a debit in the user's wallet."
          : "This refunds the held amount back to the user's available balance.",
      confirmLabel: action === "PAID" ? "Mark Paid" : "Reject",
      tone: action === "PAID" ? "default" : "danger",
    });
    if (!ok) return;

    setSavingId(id);
    const toastId = toast.loading("Processing...");
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to process request.", { id: toastId });
      } else {
        setWithdrawals((prev) => prev.map((w) => (w.id === id ? data.withdrawal : w)));
        toast.success(
          action === "PAID" ? "Marked as paid." : "Request rejected and refunded.",
          { id: toastId }
        );
      }
    } catch (e) {
      toast.error("Network error.", { id: toastId });
    } finally {
      setSavingId(null);
    }
  };

  if (!authChecked || loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-emerald-700" />
      </main>
    );
  }

  const counts = withdrawals.reduce((acc, w) => {
    acc[w.status] = (acc[w.status] || 0) + 1;
    return acc;
  }, {});
  const filtered =
    filter === "ALL" ? withdrawals : withdrawals.filter((w) => w.status === filter);

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      <section className="bg-slate-950 py-8 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-xs font-bold text-white/70 hover:text-white"
          >
            <ArrowLeft className="size-3.5" /> Back to Console
          </Link>
          <PageReveal>
            <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold tracking-tight text-white">
              <Banknote className="size-7" /> Account Payout
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Review affiliate withdrawal requests. Mark paid after sending money, or reject to refund.
            </p>
          </PageReveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        {/* Filter tabs */}
        <div className="mb-6 flex flex-wrap gap-1 rounded-md border border-slate-200 bg-white p-1 text-xs font-semibold shadow-sm sm:w-fit">
          {["PENDING", "PAID", "REJECTED", "ALL"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded px-3 py-1.5 transition-colors ${
                filter === tab
                  ? "bg-emerald-700 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
              {tab !== "ALL" && counts[tab] ? ` (${counts[tab]})` : ""}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <FadeIn className="rounded-md border border-border bg-white p-16 text-center shadow-sm">
            <Banknote className="mx-auto size-12 text-slate-300" />
            <p className="mt-4 text-sm font-bold text-slate-700">No requests in this view.</p>
          </FadeIn>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-450">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Method / Account</th>
                  <th className="p-4">Requested</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/50">
                    <td className="p-4">
                      <p className="font-bold text-slate-900">{w.user?.name}</p>
                      <p className="text-[10px] text-slate-400">{w.user?.email}</p>
                      {w.user?.phone && (
                        <p className="text-[10px] text-slate-400">{w.user.phone}</p>
                      )}
                    </td>
                    <td className="p-4 font-extrabold text-slate-900">
                      Rs. {Number(w.amount).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-800">{w.method}</p>
                      <p className="text-[10px] text-slate-500">{w.accountInfo}</p>
                    </td>
                    <td className="p-4 text-[10px] text-slate-450">
                      {new Date(w.createdAt).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-bold ${
                          STATUS_STYLES[w.status] || STATUS_STYLES.PENDING
                        }`}
                      >
                        {w.status === "PAID" ? (
                          <CheckCircle2 className="size-3" />
                        ) : w.status === "REJECTED" ? (
                          <XCircle className="size-3" />
                        ) : (
                          <Clock className="size-3" />
                        )}
                        {w.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {w.status === "PENDING" ? (
                        <div className="flex gap-2">
                          <button
                            disabled={savingId === w.id}
                            onClick={() => resolve(w.id, "PAID")}
                            className="rounded bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                          >
                            Mark Paid
                          </button>
                          <button
                            disabled={savingId === w.id}
                            onClick={() => resolve(w.id, "REJECTED")}
                            className="rounded border border-rose-300 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] italic text-slate-400">
                          {w.processedAt
                            ? `Processed ${new Date(w.processedAt).toLocaleDateString("en-IN")}`
                            : "Processed"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirmDialog}
      <SiteFooter />
    </main>
  );
}
