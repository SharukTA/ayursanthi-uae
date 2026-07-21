"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Gift,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  MapPin,
} from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useConfirm } from "@/components/ConfirmDialog";

// The reward fulfilment lifecycle reuses GiftWinStatus.
//   WON      -> milestone hit; waiting on the customer to submit a shipping address.
//   CLAIMED  -> address in; ready for the admin to ship.
//   SHIPPED  -> dispatched (adminNote holds the tracking number).
//   REJECTED -> voided.
const STATUS_STYLES = {
  WON: "bg-amber-50 text-amber-800 border-amber-200",
  CLAIMED: "bg-sky-50 text-sky-800 border-sky-200",
  SHIPPED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 border-rose-200",
};

function StatusBadge({ status }) {
  const Icon =
    status === "SHIPPED"
      ? CheckCircle2
      : status === "REJECTED"
      ? XCircle
      : status === "CLAIMED"
      ? MapPin
      : Clock;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-bold ${
        STATUS_STYLES[status] || STATUS_STYLES.WON
      }`}
    >
      <Icon className="size-3" />
      {status}
    </span>
  );
}

function formatAddress(snap) {
  if (!snap) return null;
  return [
    snap.fullName,
    snap.phone,
    snap.line1,
    snap.line2,
    [snap.city, snap.state, snap.postalCode].filter(Boolean).join(", "),
    snap.country,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function AdminReferralRewardsPage() {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [authChecked, setAuthChecked] = useState(false);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [filter, setFilter] = useState("CLAIMED");

  const fetchRewards = async () => {
    try {
      const res = await fetch("/api/admin/referral-rewards");
      const data = await res.json();
      setRewards(data.rewards || []);
    } catch (e) {
      toast.error("Failed to load referral rewards.");
    }
  };

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
        await fetchRewards();
      } catch (e) {
        console.error("Initial load failure:", e);
      } finally {
        setLoading(false);
      }
    }
    initPage();
  }, []);

  const resolve = async (reward, action) => {
    let adminNote = null;
    if (action === "SHIPPED") {
      adminNote = window.prompt(
        "Tracking number / courier note (optional):",
        ""
      );
      // Cancel on the prompt aborts the action entirely.
      if (adminNote === null) return;
      adminNote = adminNote.trim() || null;
    } else {
      const ok = await confirm({
        title: "Void this reward?",
        description:
          "This marks the free product as REJECTED (e.g. the customer was found gaming referrals). It cannot be undone.",
        confirmLabel: "Void reward",
        tone: "danger",
      });
      if (!ok) return;
    }

    setSavingId(reward.id);
    const toastId = toast.loading("Processing...");
    try {
      const res = await fetch(`/api/admin/referral-rewards/${reward.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to process reward.", { id: toastId });
      } else {
        setRewards((prev) =>
          prev.map((r) => (r.id === reward.id ? { ...r, ...data.reward } : r))
        );
        toast.success(
          action === "SHIPPED" ? "Marked as shipped." : "Reward voided.",
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

  const counts = rewards.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const filtered =
    filter === "ALL" ? rewards : rewards.filter((r) => r.status === filter);

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
              <Gift className="size-7" /> Referral Rewards
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Free products granted when a customer reaches their referral
              milestone. Ship claimed rewards, or void one that was gamed.
            </p>
          </PageReveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        {/* Filter tabs */}
        <div className="mb-6 flex flex-wrap gap-1 rounded-md border border-slate-200 bg-white p-1 text-xs font-semibold shadow-sm sm:w-fit">
          {["CLAIMED", "WON", "SHIPPED", "REJECTED", "ALL"].map((tab) => (
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
            <Gift className="mx-auto size-12 text-slate-300" />
            <p className="mt-4 text-sm font-bold text-slate-700">
              No rewards in this view.
            </p>
          </FadeIn>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-450">
                <tr>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Free Product</th>
                  <th className="p-4">Ship To</th>
                  <th className="p-4">Won</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((r) => {
                  const addr = formatAddress(r.addressSnapshot);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="p-4">
                        <p className="font-bold text-slate-900">{r.user?.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {r.user?.email}
                        </p>
                        {r.user?.phone && (
                          <p className="text-[10px] text-slate-400">
                            {r.user.phone}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {r.productImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.productImageUrl}
                              alt={r.productName}
                              className="size-9 rounded object-cover"
                            />
                          ) : (
                            <span className="flex size-9 items-center justify-center rounded bg-slate-100">
                              <Gift className="size-4 text-slate-400" />
                            </span>
                          )}
                          <div>
                            <p className="font-bold text-slate-900">
                              {r.productName}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Qty {r.quantity}
                              {r.product?.slug ? ` · in stock: ${r.product.stock}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 max-w-55">
                        {addr ? (
                          <p className="text-[10px] leading-4 text-slate-500">
                            {addr}
                          </p>
                        ) : (
                          <span className="text-[10px] italic text-slate-400">
                            Awaiting customer address
                          </span>
                        )}
                        {r.status === "SHIPPED" && r.adminNote && (
                          <p className="mt-1 text-[10px] font-bold text-emerald-700">
                            Tracking: {r.adminNote}
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-[10px] text-slate-450">
                        {new Date(r.createdAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="p-4">
                        {r.status === "CLAIMED" ? (
                          <div className="flex gap-2">
                            <button
                              disabled={savingId === r.id}
                              onClick={() => resolve(r, "SHIPPED")}
                              className="inline-flex items-center gap-1 rounded bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                            >
                              <Truck className="size-3" /> Mark Shipped
                            </button>
                            <button
                              disabled={savingId === r.id}
                              onClick={() => resolve(r, "REJECTED")}
                              className="rounded border border-rose-300 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            >
                              Void
                            </button>
                          </div>
                        ) : r.status === "WON" ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] italic text-slate-400">
                              Waiting on address
                            </span>
                            <button
                              disabled={savingId === r.id}
                              onClick={() => resolve(r, "REJECTED")}
                              className="rounded border border-rose-300 px-2.5 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            >
                              Void
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] italic text-slate-400">
                            {r.processedAt
                              ? `Processed ${new Date(
                                  r.processedAt
                                ).toLocaleDateString("en-IN")}`
                              : "Processed"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
