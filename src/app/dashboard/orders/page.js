"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Package,
  ChevronDown,
  ChevronUp,
  MapPin,
  CreditCard,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { CancelOrderDialog } from "@/components/CancelOrderDialog";
import { ReturnRequestModal } from "@/components/ReturnRequestModal";
import { OrderReturns } from "@/components/OrderReturns";
import { OrderProgress } from "@/components/OrderProgress";
import { canCancelOrder, canReturnOrder, returnWindowEndsAt } from "@/lib/returns";
import { formatMoney } from "@/lib/currency";

// Amazon renders the order status as a bold line above the items ("Delivered
// 12 July", "Cancelled", …). Greens collapse to ink in this theme, so every
// state reads as near-black ink except cancelled, which stays rose.
const STATUS_LINE = {
  DELIVERED: "text-[#0f1111]",
  CONFIRMED: "text-[#0f1111]",
  SHIPPED: "text-[#0f1111]",
  OUT_FOR_DELIVERY: "text-[#0f1111]",
  PROCESSING: "text-[#0f1111]",
  PENDING: "text-[#565959]",
  CANCELLED: "text-[#565959]",
};

// The bold line above the items, mirroring Amazon's wording.
const STATUS_LINES = {
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  OUT_FOR_DELIVERY: "Out for delivery",
  SHIPPED: "Shipped",
  PROCESSING: "Preparing to ship",
  CONFIRMED: "Order confirmed",
  PENDING: "Order placed",
};

// Statuses where the parcel is with the courier, so a consignment number is
// worth showing.
const IN_TRANSIT = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

const fmtDate = (value) =>
  new Date(value).toLocaleDateString("en-AE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

// The tabs across the top, Amazon-style. Each carries a predicate that filters
// the order list client-side.
const TABS = [
  { key: "ALL", label: "Orders", match: () => true },
  {
    key: "OPEN",
    label: "Not yet shipped",
    match: (o) => ["PENDING", "PROCESSING", "CONFIRMED"].includes(o.status),
  },
  { key: "CANCELLED", label: "Cancelled orders", match: (o) => o.status === "CANCELLED" },
];

// Shared pill styling. Arbitrary hex values (bg-[#…]) are used deliberately so
// they slip past globals.css's bg-white / bg-emerald overrides and we keep full
// control of the Amazon pill look.
const PILL_PRIMARY =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#ffd814] px-3 py-1.5 text-[13px] font-medium text-[#0f1111] shadow-sm ring-1 ring-[#fcd200] transition hover:bg-[#f7ca00]";
const PILL_SECONDARY =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#ffffff] px-3 py-1.5 text-[13px] font-medium text-[#0f1111] shadow-sm ring-1 ring-[#d5d9d9] transition hover:bg-[#f7fafa]";

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [tab, setTab] = useState("ALL");
  // Order currently being cancelled / returned, or null when no sheet is open.
  const [cancelling, setCancelling] = useState(null);
  const [returning, setReturning] = useState(null);

  const loadOrders = useCallback(
    () =>
      fetch("/api/user/orders")
        .then((r) => r.json())
        .then((data) => setOrders(data.orders || [])),
    []
  );

  useEffect(() => {
    loadOrders().finally(() => setLoading(false));
  }, [loadOrders]);

  const toggle = (id) => setExpandedId((prev) => (prev === id ? null : id));

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];
  const visibleOrders = useMemo(
    () => orders.filter(activeTab.match),
    [orders, activeTab]
  );

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <p className="animate-pulse text-sm font-medium text-[#0f1111]">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageReveal>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-[28px] font-bold leading-none text-[#0f1111]">Your Orders</h1>
          <span className="text-[13px] text-[#565959]">
            {orders.length} order{orders.length !== 1 ? "s" : ""}
          </span>
        </div>
      </PageReveal>

      {/* Tab strip — Amazon's underline tabs */}
      <div className="flex gap-6 overflow-x-auto border-b border-[#d5d9d9]">
        {TABS.map((t) => {
          const count = orders.filter(t.match).length;
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setExpandedId(null);
              }}
              className={`-mb-px whitespace-nowrap border-b-2 pb-2.5 text-[14px] transition ${
                active
                  ? "border-[#e77600] font-bold text-[#c45500]"
                  : "border-transparent font-medium text-[#007185] hover:text-[#c7511f]"
              }`}
            >
              {t.label}
              {t.key !== "ALL" && count > 0 ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      {visibleOrders.length === 0 ? (
        <FadeIn className="rounded-md border border-[#d5d9d9] bg-white p-16 text-center shadow-sm">
          <ShoppingBag className="mx-auto size-12 text-[#aab7b8]" />
          <h3 className="mt-4 text-sm font-bold text-[#0f1111]">
            {tab === "ALL" ? "No orders yet" : "Nothing here"}
          </h3>
          <p className="mt-1 text-xs text-[#565959]">
            {tab === "ALL"
              ? "Your order history will appear here after your first purchase."
              : "No orders match this filter."}
          </p>
          <Link
            href="/products"
            className="mt-5 inline-block text-xs font-bold text-[#007185] hover:text-[#c7511f] hover:underline"
          >
            Browse Products →
          </Link>
        </FadeIn>
      ) : (
        <div className="flex flex-col gap-5">
          {visibleOrders.map((order) => {
            const addr = order.addressSnapshot;
            const isOpen = expandedId === order.id;
            const lineClass = STATUS_LINE[order.status] ?? STATUS_LINE.PENDING;
            // Same policy the API enforces — see lib/returns.js. Buttons only
            // appear when the action would actually succeed.
            const cancellable = canCancelOrder(order);
            const returnable = canReturnOrder(order);
            const windowEndsAt = returnWindowEndsAt(order);
            const firstSlug = order.items.find((i) => i.product?.slug)?.product?.slug;

            const statusLine = STATUS_LINES[order.status] ?? STATUS_LINES.PENDING;

            return (
              <FadeIn
                key={order.id}
                className="overflow-hidden rounded-lg border border-[#d5d9d9] bg-white shadow-sm"
              >
                {/* ===== Grey header bar — Amazon's order meta strip ===== */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d5d9d9] bg-[#f0f2f2] px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap gap-x-8 gap-y-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#565959]">
                        Order placed
                      </p>
                      <p className="mt-0.5 text-[13px] text-[#0f1111]">
                        {fmtDate(order.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#565959]">
                        Total
                      </p>
                      <p className="mt-0.5 text-[13px] text-[#0f1111]">
                        {formatMoney(order.total)}
                      </p>
                    </div>
                    {addr?.fullName ? (
                      <div className="hidden sm:block">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#565959]">
                          Ship to
                        </p>
                        <p className="mt-0.5 max-w-[160px] truncate text-[13px] text-[#0f1111]">
                          {addr.fullName}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="font-mono text-[11px] text-[#565959]">
                      ORDER # {order.orderNumber}
                    </p>
                    <button
                      type="button"
                      onClick={() => toggle(order.id)}
                      className="mt-0.5 inline-flex items-center gap-1 text-[13px] text-[#007185] transition hover:text-[#c7511f]"
                    >
                      View order details
                      {isOpen ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                    </button>
                    {/* A cancelled order was never invoiced, so the link is
                        offered on every other state. */}
                    {order.status !== "CANCELLED" ? (
                      <a
                        href={`/dashboard/orders/${order.id}/invoice`}
                        className="mt-0.5 block text-[13px] text-[#007185] transition hover:text-[#c7511f]"
                      >
                        Download invoice
                      </a>
                    ) : null}
                  </div>
                </div>

                {/* ===== Body: status + items on the left, actions on the right ===== */}
                <div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                  <div className="min-w-0 flex-1">
                    <p className={`text-[17px] font-bold ${lineClass}`}>
                      {statusLine}
                      {order.status === "DELIVERED" && order.deliveredAt
                        ? ` ${fmtDate(order.deliveredAt)}`
                        : ""}
                      {order.status === "CANCELLED" && order.cancelledAt
                        ? ` on ${fmtDate(order.cancelledAt)}`
                        : ""}
                    </p>

                    {/* The progress bar. Renders nothing for a cancelled order —
                        that case is covered by the panel further down. */}
                    <OrderProgress order={order} />

                    {/* Courier consignment, once the parcel is actually moving.
                        Kept as plain text: the store uses whichever courier is
                        cheapest per route, so there is no single tracking URL
                        to link to. */}
                    {order.trackingNumber && IN_TRANSIT.includes(order.status) ? (
                      <p className="mt-1 text-[13px] text-[#565959]">
                        {order.courierName ? `${order.courierName} · ` : ""}
                        Tracking&nbsp;
                        <span className="font-mono text-[#0f1111]">{order.trackingNumber}</span>
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-col gap-3">
                      {order.items.map((item) => {
                        const slug = item.product?.slug;
                        const media = item.product?.images?.[0];
                        const isVideo = media?.mediaType === "VIDEO";
                        return (
                          <div key={item.id} className="flex items-start gap-3">
                            {isVideo && media?.url ? (
                              // First frame only — see the cart thumbnail note.
                              <video
                                src={`${media.url}#t=0.1`}
                                muted
                                playsInline
                                preload="metadata"
                                aria-hidden="true"
                                className="size-16 shrink-0 rounded-md border border-[#d5d9d9] object-cover"
                              />
                            ) : media?.url ? (
                              <img
                                src={media.url}
                                alt={item.productName}
                                className="size-16 shrink-0 rounded-md border border-[#d5d9d9] object-cover"
                              />
                            ) : (
                              <div className="flex size-16 shrink-0 items-center justify-center rounded-md border border-[#d5d9d9] bg-[#f7fafa]">
                                <Package className="size-6 text-[#aab7b8]" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              {slug ? (
                                <Link
                                  href={`/products/${slug}`}
                                  className="line-clamp-2 text-[14px] font-medium text-[#007185] transition hover:text-[#c7511f] hover:underline"
                                >
                                  {item.productName}
                                </Link>
                              ) : (
                                <p className="line-clamp-2 text-[14px] font-medium text-[#0f1111]">
                                  {item.productName}
                                </p>
                              )}
                              <p className="mt-0.5 text-[12px] text-[#565959]">
                                Qty: {item.quantity} · {formatMoney(item.price)}
                              </p>
                              {slug ? (
                                <Link
                                  href={`/products/${slug}`}
                                  className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#ffffff] px-3 py-1 text-[12px] font-medium text-[#0f1111] shadow-sm ring-1 ring-[#d5d9d9] transition hover:bg-[#f7fafa]"
                                >
                                  <RotateCcw className="size-3" />
                                  Buy it again
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action rail — Amazon stacks its buttons on the right */}
                  <div className="flex w-full shrink-0 flex-col gap-2 sm:w-52">
                    {firstSlug ? (
                      <Link href={`/products/${firstSlug}`} className={PILL_PRIMARY}>
                        Buy it again
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggle(order.id)}
                      className={PILL_SECONDARY}
                    >
                      View order details
                    </button>
                    {returnable.allowed ? (
                      <button
                        type="button"
                        onClick={() => setReturning(order)}
                        className={PILL_SECONDARY}
                      >
                        <RotateCcw className="size-3.5" />
                        Return or replace
                      </button>
                    ) : null}
                    {cancellable.allowed ? (
                      <button
                        type="button"
                        onClick={() => setCancelling(order)}
                        className={PILL_SECONDARY}
                      >
                        <XCircle className="size-3.5" />
                        Cancel order
                      </button>
                    ) : null}
                    {windowEndsAt && returnable.allowed ? (
                      <p className="text-center text-[11px] text-[#565959]">
                        Return window closes {fmtDate(windowEndsAt)}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* ===== Expanded detail panel ===== */}
                {isOpen && (
                  <div className="flex flex-col gap-5 border-t border-[#d5d9d9] bg-[#fbfbfb] p-4 sm:p-5">
                    {/* Cancellation summary — what happened and who did it */}
                    {order.status === "CANCELLED" ? (
                      <div className="rounded-md border border-rose-200 bg-rose-50/60 p-3 text-[11px] text-rose-900">
                        <p className="font-bold">
                          Cancelled
                          {order.cancelledBy === "ADMIN" ? " by us" : " by you"}
                          {order.cancelledAt ? ` on ${fmtDate(order.cancelledAt)}` : ""}
                        </p>
                        {order.cancelReason ? (
                          <p className="mt-0.5">Reason: {order.cancelReason}</p>
                        ) : null}
                        <p className="mt-1">
                          {Number(order.refundedTotal) > 0
                            ? `${formatMoney(order.refundedTotal)} has been refunded.`
                            : "Nothing was charged for this order."}
                        </p>
                      </div>
                    ) : null}

                    {/* Policy messaging when no action button is available */}
                    {!cancellable.allowed &&
                    ["SHIPPED", "OUT_FOR_DELIVERY"].includes(order.status) ? (
                      <p className="text-[11px] text-[#565959]">{cancellable.message}</p>
                    ) : null}
                    {!returnable.allowed && order.status === "DELIVERED" ? (
                      <p className="text-[11px] text-[#565959]">{returnable.message}</p>
                    ) : null}

                    {/* Existing returns + refunds already issued */}
                    <OrderReturns order={order} onChanged={loadOrders} />

                    {/* Price breakdown */}
                    <div className="rounded-md border border-[#d5d9d9] bg-white p-4">
                      <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#565959]">
                        Order Summary
                      </h4>
                      <div className="grid gap-2 text-xs">
                        <div className="flex justify-between text-[#3f4545]">
                          <span>Items</span>
                          <span className="font-bold text-[#0f1111]">
                            {formatMoney(order.subtotal)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[#3f4545]">
                          <span>Shipping</span>
                          <span className="font-bold text-[#0f1111]">
                            {Number(order.shipping) === 0
                              ? "FREE"
                              : formatMoney(order.shipping)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-[#d5d9d9] pt-2 font-extrabold text-[#0f1111]">
                          <span>Order Total</span>
                          <span>{formatMoney(order.total)}</span>
                        </div>
                        {Number(order.refundedTotal) > 0 ? (
                          <div className="flex justify-between font-bold text-emerald-800">
                            <span>Refunded</span>
                            <span>- {formatMoney(order.refundedTotal)}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      {/* Shipping address */}
                      {addr && (
                        <div>
                          <h4 className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#565959]">
                            <MapPin className="size-3" />
                            Shipping Address
                          </h4>
                          <p className="text-xs leading-6 text-[#0f1111]">
                            {addr.fullName}
                            {addr.phone ? ` · ${addr.phone}` : ""}
                            <br />
                            {addr.line1}
                            {addr.line2 ? `, ${addr.line2}` : ""}
                            <br />
                            {addr.city}, {addr.state} — {addr.postalCode}
                            {addr.country ? `, ${addr.country}` : ""}
                          </p>
                        </div>
                      )}

                      {/* Payment info */}
                      <div>
                        <h4 className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#565959]">
                          <CreditCard className="size-3" />
                          Payment
                        </h4>
                        <p className="text-xs text-[#3f4545]">
                          Status:{" "}
                          <span
                            className={`font-bold ${
                              order.paymentStatus === "PAID"
                                ? "text-[#0f1111]"
                                : order.paymentStatus === "REFUNDED"
                                  ? "text-emerald-700"
                                  : "text-amber-600"
                            }`}
                          >
                            {order.paymentStatus}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </FadeIn>
            );
          })}
        </div>
      )}

      {cancelling ? (
        <CancelOrderDialog
          order={cancelling}
          onClose={() => setCancelling(null)}
          onCancelled={loadOrders}
        />
      ) : null}

      {returning ? (
        <ReturnRequestModal
          order={returning}
          onClose={() => setReturning(null)}
          onSubmitted={loadOrders}
        />
      ) : null}
    </div>
  );
}
