"use client";

import { BadgeCheck, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/currency";

/**
 * "Refunds issued" — every dirham that has actually gone back on this order,
 * read from the refund rows of the payment ledger.
 *
 * The store does not accept returns, so a refund here always comes from a
 * cancellation. Renders nothing when no money has moved.
 */

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function OrderRefunds({ order }) {
  const refunds = (order.payments ?? []).filter((payment) => payment.status === "REFUNDED");

  if (refunds.length === 0) {
    return null;
  }

  return (
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
              Order cancellation · {formatDate(refund.createdAt)}
            </span>
            <span className="shrink-0 font-extrabold">{formatMoney(refund.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-emerald-800">
        Bank transfers usually land in 3-5 business days.
      </p>
    </div>
  );
}
