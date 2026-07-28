"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, XCircle } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { CANCEL_REASONS } from "@/lib/returns";
import { formatMoney } from "@/lib/currency";

/**
 * "Cancel items" — the Amazon cancellation sheet: pick a reason, confirm, done.
 * Cancelling always covers the whole order here, because an order is placed and
 * dispatched as one parcel.
 *
 * The copy about money changes with what was actually collected: Cash on
 * Delivery that never shipped costs the customer nothing, while an order whose
 * cash was already taken is refunded in full.
 */
export function CancelOrderDialog({ order, onClose, onCancelled }) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const alreadyPaid = order.paymentStatus === "PAID";

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
              ? `You have already paid for this order, so ${formatMoney(order.total)} will be refunded to you.`
              : "You pay cash on delivery, so nothing has been charged and there is nothing to refund."}
          </p>
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
