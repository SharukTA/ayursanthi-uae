"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, XCircle } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import {
  STORE_CANCEL_REASONS,
  cancelWindowEndsAt,
  formatCancelDeadline,
  formatCancelWindow,
} from "@/lib/order-policy";
import { useSiteSettings } from "@/components/SettingsProvider";
import { formatMoney } from "@/lib/currency";

/**
 * The store's own cancellation sheet, the admin-side twin of CancelOrderDialog.
 *
 * It needs a modal of its own rather than a plain useConfirm(): cancelling on
 * the store's behalf has to capture *why*, and the reason is not internal
 * bookkeeping — it is written to Order.cancelReason, mailed to the customer, and
 * shown on their orders page. A confirm dialog with a yes/no has nowhere to put
 * that, and window.prompt() is how you end up with "asdf" in a customer email.
 *
 * The reason is resolved to its label here, before it is sent, because the API
 * stores the string verbatim — the same contract the customer's own cancel route
 * follows.
 */
export function AdminCancelOrderDialog({ order, onClose, onCancelled, onStale }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const alreadyPaid = order.paymentStatus === "PAID";
  const { order_cancel_window_hours: windowHours } = useSiteSettings();
  const deadline = cancelWindowEndsAt(order, windowHours);

  const submit = async (event) => {
    event.preventDefault();

    if (!reason) {
      toast.error("Choose why the store is cancelling this order.");
      return;
    }

    const label = STORE_CANCEL_REASONS.find((r) => r.value === reason)?.label ?? reason;
    const trimmed = note.trim();

    setSubmitting(true);
    const toastId = toast.loading("Cancelling order...");

    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CANCELLED",
          reason: trimmed ? `${label} — ${trimmed}` : label,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Could not cancel this order.", { id: toastId });
        // jsonError() nests extras under `details`. A closed window means the
        // row has lost its button, so the sheet closes and the table reloads;
        // anything else is worth retrying with the reason already typed.
        if (data.details?.code === "cancel_window_closed") {
          onStale?.();
          onClose();
        }
        return;
      }

      toast.success(`${order.orderNumber} cancelled.`, { id: toastId });
      onCancelled?.(data.order);
      onClose();
    } catch {
      toast.error("Network error. Please try again.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Cancel this order" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="rounded-md border border-[#d5d9d9] bg-[#f8fafc] p-3 text-[11px] text-[#3f4545]">
          <p className="font-bold text-[#0f1111]">Order {order.orderNumber}</p>
          <p className="mt-0.5">
            {order.user?.name ? `${order.user.name} · ` : ""}
            {order.items.length} item{order.items.length !== 1 ? "s" : ""} ·{" "}
            {formatMoney(order.total)}
          </p>
          <p className="mt-1.5">
            {alreadyPaid
              ? `Stock goes back on the shelf and ${formatMoney(order.total)} is refunded to the customer's card. Refunds usually reach the account within 5–10 business days.`
              : "This order was never paid for, so stock goes back on the shelf and there is nothing to refund."}
          </p>
          {deadline ? (
            <p className="mt-1.5">
              The cancellation window for this order runs for{" "}
              {formatCancelWindow(windowHours)} from when it was placed, until{" "}
              <span className="font-bold text-[#0f1111]">{formatCancelDeadline(deadline)}</span>.
              The store is held to it too — past that point the courier has the parcel.
            </p>
          ) : null}
          {order.logisticsNotifiedAt ? (
            // Worth saying out loud: the courier already has a live booking, and
            // cancelOrder() emails them to pull it. If the parcel has already
            // been collected, somebody has to chase it.
            <p className="mt-1.5 font-bold text-rose-700">
              Logistics were already told to ship this. They will be emailed to cancel the
              booking — recall the parcel if it has already been collected.
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="admin-cancel-reason"
            className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#565959]"
          >
            Reason for cancellation
          </label>
          <select
            id="admin-cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-[#d5d9d9] bg-white px-3 py-2 text-xs text-[#0f1111] outline-none focus:border-[#0f1111]"
          >
            <option value="">Choose a reason</option>
            {STORE_CANCEL_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Anything to add? (optional)"
            className="mt-2 w-full resize-none rounded-md border border-[#d5d9d9] bg-white px-3 py-2 text-xs text-[#0f1111] outline-none placeholder:text-[#565959] focus:border-[#0f1111]"
          />
          <p className="mt-1.5 text-[10px] text-[#565959]">
            The customer sees this on their orders page and in the cancellation email.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            Keep order
          </Button>
          <Button type="submit" variant="destructive" size="sm" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <XCircle className="size-4" />
                Cancel order
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
