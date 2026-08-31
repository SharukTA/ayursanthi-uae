"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, XCircle } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import {
  CANCEL_REASONS,
  cancelWindowEndsAt,
  formatCancelDeadline,
  formatCancelWindow,
} from "@/lib/order-policy";
import { useSiteSettings } from "@/components/SettingsProvider";
import { formatMoney } from "@/lib/currency";

/**
 * "Cancel items" — the Amazon cancellation sheet: pick a reason, confirm, done.
 * Cancelling always covers the whole order here, because an order is placed and
 * dispatched as one parcel.
 *
 * The copy about money changes with what was actually collected: an order whose
 * payment never completed costs the customer nothing, while a paid one is
 * refunded to the card in full.
 */
export function CancelOrderDialog({ order, onClose, onCancelled, onStale }) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const alreadyPaid = order.paymentStatus === "PAID";
  // The deadline is repeated here, on the last screen before the order is
  // pulled, because this is where a shopper decides whether to cancel now or
  // "think about it" — and after the window there is no thinking about it.
  const { order_cancel_window_hours: windowHours } = useSiteSettings();
  const deadline = cancelWindowEndsAt(order, windowHours);

  const submit = async (event) => {
    event.preventDefault();

    if (!reason) {
      toast.error("Choose why you are cancelling.");
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading("Cancelling your order...");

    try {
      const res = await fetch(`/api/user/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, comment: comment.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Could not cancel this order.", { id: toastId });
        // A closed window is not a retry: the button is gone from the list
        // behind this sheet, so leaving the form open would only invite a
        // second submit with the same answer. Every other refusal — a refund
        // Stripe would not take, a network blip — keeps the form so the reason
        // and comment already typed are not lost.
        if (data.code === "cancel_window_closed") {
          onStale?.();
          onClose();
        }
        return;
      }

      toast.success(data.message || "Order cancelled.", { id: toastId });
      onCancelled?.();
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
            {order.items.length} item{order.items.length !== 1 ? "s" : ""} · {formatMoney(order.total)}
          </p>
          <p className="mt-1.5">
            {alreadyPaid
              ? `You paid ${formatMoney(order.total)} for this order, so it will be refunded to the card you paid with. It usually reaches your account within 5–10 business days.`
              : "This order was never paid for, so nothing has been charged and there is nothing to refund."}
          </p>
          {deadline ? (
            <p className="mt-1.5 border-t border-[#d5d9d9] pt-1.5">
              Orders can be cancelled within {formatCancelWindow(windowHours)} of being placed —
              until{" "}
              <span className="font-bold text-[#0f1111]">{formatCancelDeadline(deadline)}</span> for
              this one. After that it is with our delivery partner and cannot be cancelled.
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="cancel-reason"
            className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#565959]"
          >
            Reason for cancellation
          </label>
          <select
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-[#d5d9d9] bg-white px-3 py-2 text-xs text-[#0f1111] outline-none focus:border-[#0f1111]"
          >
            <option value="">Choose a reason</option>
            {CANCEL_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Anything else we should know? (optional)"
            className="mt-2 w-full resize-none rounded-md border border-[#d5d9d9] bg-white px-3 py-2 text-xs text-[#0f1111] outline-none placeholder:text-[#565959] focus:border-[#0f1111]"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
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
