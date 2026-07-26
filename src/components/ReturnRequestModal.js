"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Package, RotateCcw } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import {
  REFUND_METHODS,
  RETURN_REASONS,
  RETURN_RESOLUTIONS,
  computeRefundBreakdown,
  returnWindowEndsAt,
  returnableUnits,
} from "@/lib/returns";

/**
 * "Return or replace items" — the Amazon return wizard, in one form:
 * pick the items and how many of each, say why, choose refund or replacement,
 * and (for a refund on a Cash-on-Delivery order) say where the money should go.
 *
 * The refund preview is computed with the same helper the server uses, so the
 * number shown here is the number that gets written — the API still recomputes
 * it from the stored order and ignores anything the browser sends.
 */
export function ReturnRequestModal({ order, onClose, onSubmitted }) {
  const available = useMemo(() => returnableUnits(order), [order]);
  const returnableItems = order.items.filter((item) => (available[item.id] ?? 0) > 0);

  const [quantities, setQuantities] = useState({});
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [resolution, setResolution] = useState("REFUND");
  const [refundMethod, setRefundMethod] = useState("BANK_TRANSFER");
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selections = Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));

  // Cheap arithmetic over a handful of lines — no point memoising it.
  const breakdown = computeRefundBreakdown(order, selections);

  const windowEndsAt = returnWindowEndsAt(order);

  const toggleItem = (itemId, checked) => {
    setQuantities((prev) => {
      const next = { ...prev };
      if (checked) next[itemId] = 1;
      else delete next[itemId];
      return next;
    });
  };

  const setQuantity = (itemId, quantity) => {
    setQuantities((prev) => ({ ...prev, [itemId]: Number(quantity) }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (selections.length === 0) {
      toast.error("Select at least one item to return.");
      return;
    }
    if (!reason) {
      toast.error("Choose a reason for the return.");
      return;
    }
    if (reason === "OTHER" && !comment.trim()) {
      toast.error("Tell us what went wrong so we can process your return.");
      return;
    }
    if (resolution === "REFUND" && refundMethod === "BANK_TRANSFER") {
      if (!accountName.trim() || !accountNumber.trim()) {
        toast.error("Enter the account holder name and account number.");
        return;
      }
    }

    setSubmitting(true);
    const toastId = toast.loading("Submitting your return request...");

    try {
      const res = await fetch(`/api/user/orders/${order.id}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selections,
          reason,
          comment: comment.trim(),
          resolution,
          refundMethod: resolution === "REFUND" ? refundMethod : undefined,
          refundDetails:
            resolution === "REFUND" && refundMethod === "BANK_TRANSFER"
              ? {
                  accountName: accountName.trim(),
                  bankName: bankName.trim(),
                  accountNumber: accountNumber.trim(),
                }
              : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Could not create this return request.", { id: toastId });
        return;
      }

      toast.success(data.message || "Return requested.", { id: toastId });
      onSubmitted?.();
      onClose();
    } catch {
      toast.error("Network error. Please try again.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Return or replace items" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="rounded-md border border-[#d5d9d9] bg-[#f8fafc] p-3 text-[11px] text-[#3f4545]">
          <p className="font-bold text-[#0f1111]">Order {order.orderNumber}</p>
          {windowEndsAt ? (
            <p className="mt-0.5">
              Eligible for return until {windowEndsAt.toLocaleDateString("en-IN", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
              .
            </p>
          ) : null}
        </div>

        {/* 1. Which items, and how many of each */}
        <fieldset>
          <legend className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#565959]">
            Select items
          </legend>
          <div className="flex flex-col gap-2">
            {returnableItems.map((item) => {
              const max = available[item.id];
              const selected = quantities[item.id] > 0;

              return (
                <label
                  key={item.id}
                  className={`flex items-start gap-3 rounded-md border p-3 transition ${
                    selected ? "border-[#0f1111] bg-[#f8fafc]" : "border-[#d5d9d9] bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => toggleItem(item.id, e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-[#0f1111]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-[#0f1111]">
                      <Package className="size-3.5 shrink-0 text-[#565959]" />
                      <span className="truncate">{item.productName}</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] text-[#565959]">
                      Rs. {Number(item.price).toLocaleString()} · {max} of {item.quantity} unit
                      {item.quantity !== 1 ? "s" : ""} returnable
                    </span>

                    {selected && max > 1 ? (
                      <span className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] text-[#3f4545]">Quantity</span>
                        <select
                          value={quantities[item.id]}
                          onChange={(e) => setQuantity(item.id, e.target.value)}
                          className="rounded border border-[#d5d9d9] bg-white px-2 py-1 text-[11px] font-bold text-[#0f1111] outline-none"
                        >
                          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* 2. Why */}
        <div>
          <label
            htmlFor="return-reason"
            className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#565959]"
          >
            Reason for return
          </label>
          <select
            id="return-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-[#d5d9d9] bg-white px-3 py-2 text-xs text-[#0f1111] outline-none focus:border-[#0f1111]"
          >
            <option value="">Choose a reason</option>
            {RETURN_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={
              reason === "OTHER"
                ? "Tell us what went wrong (required)"
                : "Add any details for our team (optional)"
            }
            className="mt-2 w-full resize-none rounded-md border border-[#d5d9d9] bg-white px-3 py-2 text-xs text-[#0f1111] outline-none placeholder:text-[#565959] focus:border-[#0f1111]"
          />
        </div>

        {/* 3. Refund or replacement */}
        <fieldset>
          <legend className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#565959]">
            What would you like?
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {RETURN_RESOLUTIONS.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-md border p-3 transition ${
                  resolution === option.value
                    ? "border-[#0f1111] bg-[#f8fafc]"
                    : "border-[#d5d9d9] bg-white"
                }`}
              >
                <span className="flex items-center gap-2 text-xs font-bold text-[#0f1111]">
                  <input
                    type="radio"
                    name="resolution"
                    value={option.value}
                    checked={resolution === option.value}
                    onChange={() => setResolution(option.value)}
                    className="size-3.5 accent-[#0f1111]"
                  />
                  {option.label}
                </span>
                <span className="mt-1 block text-[11px] leading-5 text-[#565959]">{option.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* 4. Where the money goes — refunds only */}
        {resolution === "REFUND" ? (
          <fieldset>
            <legend className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#565959]">
              Refund method
            </legend>
            <div className="flex flex-col gap-2">
              {REFUND_METHODS.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-md border p-3 transition ${
                    refundMethod === option.value
                      ? "border-[#0f1111] bg-[#f8fafc]"
                      : "border-[#d5d9d9] bg-white"
                  }`}
                >
                  <span className="flex items-center gap-2 text-xs font-bold text-[#0f1111]">
                    <input
                      type="radio"
                      name="refundMethod"
                      value={option.value}
                      checked={refundMethod === option.value}
                      onChange={() => setRefundMethod(option.value)}
                      className="size-3.5 accent-[#0f1111]"
                    />
                    {option.label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-5 text-[#565959]">
                    {option.hint}
                  </span>
                </label>
              ))}
            </div>

            {refundMethod === "BANK_TRANSFER" ? (
              <div className="mt-3 grid gap-2">
                <input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Account holder name"
                  className="w-full rounded-md border border-[#d5d9d9] bg-white px-3 py-2 text-xs text-[#0f1111] outline-none placeholder:text-[#565959] focus:border-[#0f1111]"
                />
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Bank name (optional)"
                  className="w-full rounded-md border border-[#d5d9d9] bg-white px-3 py-2 text-xs text-[#0f1111] outline-none placeholder:text-[#565959] focus:border-[#0f1111]"
                />
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Account number / IBAN"
                  className="w-full rounded-md border border-[#d5d9d9] bg-white px-3 py-2 text-xs text-[#0f1111] outline-none placeholder:text-[#565959] focus:border-[#0f1111]"
                />
                <p className="text-[10px] leading-4 text-[#565959]">
                  You paid cash on delivery, so there is no card to refund. We transfer the
                  amount to this account once the item reaches us.
                </p>
              </div>
            ) : null}

            {/* Live refund preview — the item value (GST included), plus shipping
                when nothing sellable stays with the customer. */}
            <div className="mt-3 rounded-md border border-[#d5d9d9] bg-[#f8fafc] p-3 text-[11px]">
              <div className="flex justify-between text-[#3f4545]">
                <span>Item value (incl. GST)</span>
                <span className="font-bold text-[#0f1111]">
                  Rs. {breakdown.items.toLocaleString()}
                </span>
              </div>
              <div className="mt-1 flex justify-between text-[#565959]">
                <span className="pl-2">of which GST</span>
                <span>Rs. {breakdown.tax.toLocaleString()}</span>
              </div>
              <div className="mt-1 flex justify-between text-[#3f4545]">
                <span>Shipping refunded</span>
                <span className="font-bold text-[#0f1111]">
                  {breakdown.shipping > 0
                    ? `Rs. ${breakdown.shipping.toLocaleString()}`
                    : "Not refundable"}
                </span>
              </div>
              <div className="mt-2 flex justify-between border-t border-[#d5d9d9] pt-2 text-xs font-extrabold text-[#0f1111]">
                <span>Estimated refund</span>
                <span>Rs. {breakdown.total.toLocaleString()}</span>
              </div>
            </div>
          </fieldset>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Close
          </Button>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <RotateCcw className="size-4" />
                Submit return request
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
