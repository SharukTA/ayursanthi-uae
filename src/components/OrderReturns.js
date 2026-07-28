"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Loader2, RotateCcw, Wallet } from "lucide-react";
import {
  CUSTOMER_WITHDRAWABLE_RETURN_STATUSES,
  RETURN_STATUS_COPY,
  returnReasonLabel,
} from "@/lib/returns";
import { formatMoney } from "@/lib/currency";

/**
 * The "Your Returns" block shown inside an expanded order: every return request
 * on this order with its current stage, plus every rupee that has actually gone
 * back (the refund rows of the payment ledger).
 */

const RETURN_STATUS_STYLES = {
  REQUESTED: "bg-slate-100 text-slate-700 border-slate-200",
  APPROVED: "bg-indigo-50 text-indigo-800 border-indigo-200",
  PICKED_UP: "bg-blue-50 text-blue-800 border-blue-200",
  RECEIVED: "bg-amber-50 text-amber-800 border-amber-200",
  REFUNDED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REPLACED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 border-rose-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function OrderReturns({ order, onChanged }) {
  const [busyId, setBusyId] = useState(null);

  const returns = order.returns ?? [];
  const refunds = (order.payments ?? []).filter((payment) => payment.status === "REFUNDED");

  if (returns.length === 0 && refunds.length === 0) {
    return null;
  }

  const itemsById = new Map(order.items.map((item) => [item.id, item]));

  const withdraw = async (returnId) => {
    setBusyId(returnId);
    const toastId = toast.loading("Cancelling your return request...");
    try {
      const res = await fetch(`/api/user/returns/${returnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Could not cancel this return.", { id: toastId });
        return;
      }
      toast.success(data.message || "Return cancelled.", { id: toastId });
      onChanged?.();
    } catch {
      toast.error("Network error. Please try again.", { id: toastId });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {returns.length > 0 ? (
        <div>
          <h4 className="mb-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#565959]">
            <RotateCcw className="size-3" />
            Returns &amp; Replacements
          </h4>

          <div className="flex flex-col gap-3">
            {returns.map((request) => {
              const copy = RETURN_STATUS_COPY[request.status] ?? {
                label: request.status,
                hint: "",
              };
              const canWithdraw = CUSTOMER_WITHDRAWABLE_RETURN_STATUSES.includes(request.status);

              return (
                <div
                  key={request.id}
                  className="rounded-md border border-[#d5d9d9] bg-white p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-bold text-[#0f1111]">
                        {request.returnNumber}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#565959]">
                        Requested {formatDate(request.requestedAt)} ·{" "}
                        {request.resolution === "REPLACEMENT" ? "Replacement" : "Refund"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded border px-2 py-0.5 text-[9px] font-bold ${
                        RETURN_STATUS_STYLES[request.status] ?? RETURN_STATUS_STYLES.REQUESTED
                      }`}
                    >
                      {copy.label}
                    </span>
                  </div>

                  <p className="mt-2 text-[11px] text-[#3f4545]">{copy.hint}</p>

                  <ul className="mt-3 flex flex-col gap-1">
                    {(request.items ?? []).map((line) => (
                      <li key={line.id} className="text-[11px] text-[#0f1111]">
                        {line.quantity} ×{" "}
                        {itemsById.get(line.orderItemId)?.productName ?? "Item"}
                      </li>
                    ))}
                  </ul>

                  <p className="mt-2 text-[11px] text-[#565959]">
                    Reason: {returnReasonLabel(request.reason)}
                    {request.comment ? ` — ${request.comment}` : ""}
                  </p>

                  {request.resolution === "REFUND" ? (
                    <p className="mt-1 text-[11px] text-[#3f4545]">
                      Refund amount:{" "}
                      <span className="font-bold text-[#0f1111]">
                        {formatMoney(request.refundAmount)}
                      </span>
                      {request.refundReference ? ` · Ref ${request.refundReference}` : ""}
                    </p>
                  ) : null}

                  {request.adminNote ? (
                    <p className="mt-2 rounded border border-[#d5d9d9] bg-[#f8fafc] p-2 text-[11px] text-[#3f4545]">
                      <span className="font-bold text-[#0f1111]">Note from us:</span>{" "}
                      {request.adminNote}
                    </p>
                  ) : null}

                  {canWithdraw ? (
                    <button
                      type="button"
                      disabled={busyId === request.id}
                      onClick={() => withdraw(request.id)}
                      className="mt-3 inline-flex items-center gap-1 rounded border border-[#d5d9d9] px-2.5 py-1 text-[10px] font-bold text-[#0f1111] transition hover:bg-[#f8fafc] disabled:opacity-50"
                    >
                      {busyId === request.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : null}
                      Cancel return request
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {refunds.length > 0 ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-4">
          <h4 className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-900">
            <Wallet className="size-3" />
            Refunds issued
          </h4>
          <ul className="mt-2 flex flex-col gap-1">
            {refunds.map((refund) => (
              <li
                key={refund.id}
                className="flex items-center justify-between gap-3 text-[11px] text-emerald-900"
              >
                <span className="flex items-center gap-1">
                  <BadgeCheck className="size-3.5 shrink-0" />
                  {refund.rawResponse?.kind === "cancellation_refund"
                    ? "Order cancellation"
                    : `Return ${refund.rawResponse?.returnNumber ?? ""}`.trim()}
                  {" · "}
                  {formatDate(refund.createdAt)}
                </span>
                <span className="shrink-0 font-extrabold">
                  {formatMoney(refund.amount)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-emerald-800">
            Bank transfers usually land in 3-5 business days.
          </p>
        </div>
      ) : null}
    </div>
  );
}
