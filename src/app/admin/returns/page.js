"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Banknote,
  Loader2,
  Package,
  RotateCcw,
  Search,
} from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import {
  RETURN_STATUS_TRANSITIONS,
  isTerminalReturnStatus,
  returnReasonLabel,
} from "@/lib/returns";
import { formatMoney } from "@/lib/currency";

// What each move actually does behind the scenes — spelled out on the confirm
// sheet so nobody refunds cash by accident.
const ACTION_COPY = {
  APPROVED: {
    label: "Approve return",
    effect: "The customer is told to keep the item packed for pickup.",
  },
  PICKED_UP: {
    label: "Mark picked up",
    effect: "Records that the courier has collected the item.",
  },
  RECEIVED: {
    label: "Mark received",
    effect:
      "Confirms the item is back with us. Sellable units go straight back into stock (damaged and defective returns are written off instead).",
  },
  REFUNDED: {
    label: "Issue refund",
    effect:
      "Writes the refund to the payment ledger and adds it to the order's refunded total. Do this only after the money has actually been sent.",
  },
  REPLACED: {
    label: "Mark replacement sent",
    effect: "Closes the request and takes the replacement unit out of stock.",
  },
  REJECTED: {
    label: "Decline return",
    effect: "Closes the request. The note you write is shown to the customer.",
  },
};

const STATUS_STYLES = {
  REQUESTED: "bg-slate-100 text-slate-700 border-slate-200",
  APPROVED: "bg-indigo-50 text-indigo-800 border-indigo-200",
  PICKED_UP: "bg-blue-50 text-blue-800 border-blue-200",
  RECEIVED: "bg-amber-50 text-amber-800 border-amber-200",
  REFUNDED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REPLACED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 border-rose-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

const FILTERS = [
  { value: "OPEN", label: "Open" },
  { value: "ALL", label: "All" },
  { value: "REQUESTED", label: "Awaiting approval" },
  { value: "RECEIVED", label: "Ready to refund" },
];

export default function AdminReturnsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("OPEN");
  // { request, status } while the confirm sheet is open.
  const [pendingAction, setPendingAction] = useState(null);
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchReturns = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/returns");
      const data = await res.json();
      setReturns(data.returns || []);
    } catch {
      toast.error("Failed to load returns.");
    }
  }, []);

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
        await fetchReturns();
      } catch (e) {
        console.error("Initial load failure:", e);
      } finally {
        setLoading(false);
      }
    }
    initPage();
  }, [fetchReturns, router]);

  const openAction = (request, status) => {
    setPendingAction({ request, status });
    setNote("");
    setReference("");
  };

  const applyAction = async () => {
    const { request, status } = pendingAction;

    if (status === "REJECTED" && !note.trim()) {
      toast.error("Add a note explaining why this return is declined.");
      return;
    }

    setSaving(true);
    const toastId = toast.loading("Updating return...");
    try {
      const res = await fetch(`/api/admin/returns/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(note.trim() ? { adminNote: note.trim() } : {}),
          ...(status === "REFUNDED" ? { refundReference: reference.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Could not update this return.", { id: toastId });
        return;
      }
      toast.success(`Return marked ${status}.`, { id: toastId });
      setPendingAction(null);
      await fetchReturns();
    } catch {
      toast.error("Network error.", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (!authChecked || loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-emerald-700" />
      </main>
    );
  }

  const filtered = returns.filter((request) => {
    if (filter === "OPEN" && isTerminalReturnStatus(request.status)) return false;
    if (filter !== "OPEN" && filter !== "ALL" && request.status !== filter) return false;

    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      request.returnNumber.toLowerCase().includes(q) ||
      request.order?.orderNumber?.toLowerCase().includes(q) ||
      request.user?.name?.toLowerCase().includes(q) ||
      request.user?.email?.toLowerCase().includes(q)
    );
  });

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
              <RotateCcw className="size-7" /> Returns &amp; Refunds
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Approve returns, confirm the item is back, then refund or replace. Stock and the
              payment ledger update automatically.
            </p>
          </PageReveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 shadow-sm sm:max-w-sm sm:flex-1">
            <Search className="size-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by return #, order #, name, or email"
              className="w-full text-sm text-[#0f1111] outline-none placeholder:text-[#565959]"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={`rounded-md border px-3 py-1.5 text-xs font-bold transition ${
                  filter === option.value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <FadeIn className="rounded-md border border-border bg-white p-16 text-center shadow-sm">
            <RotateCcw className="mx-auto size-12 text-slate-300" />
            <p className="mt-4 text-sm font-bold text-slate-700">No returns to show.</p>
          </FadeIn>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((request) => {
              const nextStatuses = RETURN_STATUS_TRANSITIONS[request.status] ?? [];

              return (
                <FadeIn
                  key={request.id}
                  className="flex flex-col gap-3 rounded-md border border-border bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-emerald-800">
                        {request.returnNumber}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Order{" "}
                        <span className="font-mono font-bold text-slate-700">
                          {request.order?.orderNumber}
                        </span>{" "}
                        · {new Date(request.requestedAt).toLocaleDateString("en-AE")}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded border px-2 py-0.5 text-[9px] font-bold ${
                        STATUS_STYLES[request.status] ?? STATUS_STYLES.REQUESTED
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700">
                    <p className="font-bold text-slate-900">{request.user?.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {request.user?.email}
                      {request.user?.phone ? ` · ${request.user.phone}` : ""}
                    </p>
                  </div>

                  <ul className="flex flex-col gap-1 rounded-md border border-slate-100 bg-slate-50/60 p-3">
                    {request.items.map((line) => (
                      <li
                        key={line.id}
                        className="flex items-center justify-between gap-2 text-[11px] text-slate-700"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Package className="size-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">
                            {line.quantity} × {line.orderItem?.productName}
                          </span>
                        </span>
                        <span className="shrink-0 font-bold text-slate-900">
                          {formatMoney(line.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="grid gap-1 text-[11px] text-slate-600">
                    <p>
                      <span className="font-bold text-slate-900">Wants:</span>{" "}
                      {request.resolution === "REPLACEMENT" ? "Replacement" : "Refund"}
                      {request.resolution === "REFUND"
                        ? ` of ${formatMoney(request.refundAmount)}`
                        : ""}
                    </p>
                    <p>
                      <span className="font-bold text-slate-900">Reason:</span>{" "}
                      {returnReasonLabel(request.reason)}
                      {request.comment ? ` — ${request.comment}` : ""}
                    </p>
                    {request.refundMethod ? (
                      <p className="flex items-start gap-1">
                        <Banknote className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                        <span>
                          {request.refundMethod === "BANK_TRANSFER" ? "Bank transfer" : "Cash on pickup"}
                          {request.refundDetails
                            ? ` — ${request.refundDetails.accountName ?? ""}${
                                request.refundDetails.bankName
                                  ? `, ${request.refundDetails.bankName}`
                                  : ""
                              }${
                                request.refundDetails.accountNumber
                                  ? `, ${request.refundDetails.accountNumber}`
                                  : ""
                              }`
                            : ""}
                        </span>
                      </p>
                    ) : null}
                    {request.refundReference ? (
                      <p>
                        <span className="font-bold text-slate-900">Transfer ref:</span>{" "}
                        {request.refundReference}
                      </p>
                    ) : null}
                    {request.adminNote ? (
                      <p>
                        <span className="font-bold text-slate-900">Note:</span> {request.adminNote}
                      </p>
                    ) : null}
                  </div>

                  {nextStatuses.length > 0 ? (
                    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      {nextStatuses.map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => openAction(request, status)}
                          className={`rounded-md border px-3 py-1.5 text-xs font-bold transition ${
                            status === "REJECTED"
                              ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                          }`}
                        >
                          {ACTION_COPY[status]?.label ?? status}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                      Closed — no further action possible.
                    </p>
                  )}
                </FadeIn>
              );
            })}
          </div>
        )}
      </section>

      {pendingAction ? (
        <Modal
          title={ACTION_COPY[pendingAction.status]?.label ?? pendingAction.status}
          onClose={() => (saving ? null : setPendingAction(null))}
        >
          <div className="flex flex-col gap-4 text-slate-700">
            <p className="text-xs leading-6">{ACTION_COPY[pendingAction.status]?.effect}</p>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px]">
              <p className="font-mono font-bold text-slate-900">
                {pendingAction.request.returnNumber}
              </p>
              <p className="mt-0.5">
                {pendingAction.request.user?.name} · Order{" "}
                {pendingAction.request.order?.orderNumber}
              </p>
              {pendingAction.status === "REFUNDED" ? (
                <p className="mt-1 font-bold text-slate-900">
                  Refund: {formatMoney(pendingAction.request.refundAmount)}
                </p>
              ) : null}
            </div>

            {pendingAction.status === "REFUNDED" ? (
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Transfer reference (shown to the customer)"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-900"
              />
            ) : null}

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={
                pendingAction.status === "REJECTED"
                  ? "Why is this return declined? (shown to the customer)"
                  : "Note for the customer (optional)"
              }
              className="w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-900"
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={saving}
                onClick={() => setPendingAction(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant={pendingAction.status === "REJECTED" ? "destructive" : "default"}
                disabled={saving}
                onClick={applyAction}
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Confirm"
                )}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      <SiteFooter />
    </main>
  );
}
