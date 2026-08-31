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
  Truck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { FadeIn, PageReveal } from "@/components/Animated";
import { CancelOrderDialog } from "@/components/CancelOrderDialog";
import { OrderRefunds } from "@/components/OrderRefunds";
import {
  canCancelOrder,
  formatCancelDeadline,
  formatCancelWindow,
} from "@/lib/order-policy";
import { useSiteSettings } from "@/components/SettingsProvider";
import { formatMoney } from "@/lib/currency";
import { formatAddressLines } from "@/lib/address";

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
//
// Only PENDING, CONFIRMED and CANCELLED are still written — once payment clears
// the order is confirmed and the courier owns the rest of the journey, tracked
// by AWB number on their side rather than reported back here. The remaining
// entries are for orders placed under the old admin-driven ladder, which must
// keep reading correctly forever.
const STATUS_LINES = {
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  OUT_FOR_DELIVERY: "Out for delivery",
  SHIPPED: "Shipped",
  PROCESSING: "Preparing to ship",
  CONFIRMED: "Order confirmed",
  PENDING: "Order placed",
};

const fmtDate = (value) =>
  new Date(value).toLocaleDateString("en-AE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

// The tabs across the top, Amazon-style. Each carries a predicate that filters
// the order list client-side.
//
// Just the two. Amazon's middle tabs slice orders by where the parcel is, and
// this store does not know that — the courier takes it once payment clears and
// reports back to the customer directly, by AWB. A tab that cannot say anything
// the "Orders" tab doesn't is a tab that only makes the shopper click twice.
const TABS = [
  { key: "ALL", label: "Orders", match: () => true },
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
  // Order currently being cancelled, or null when no sheet is open.
  const [cancelling, setCancelling] = useState(null);
  // The live cancellation window, seeded server-side by SettingsProvider, so the
  // deadline shown here is the one the API will enforce.
  const { order_cancel_window_hours: windowHours } = useSiteSettings();
  // Re-read every minute so a window that runs out while the page is open takes
  // the button away with it, rather than leaving a shopper to click it and be
  // told no by the server.
  const [now, setNow] = useState(() => Date.now());

  // One timer drives both: the list re-renders with the new instant, and an open
  // cancellation sheet is shut if its order left the window while the shopper
  // was filling it in. Without the second half they would sit in front of a form
  // still promising a deadline that has passed, and learn otherwise only from
  // the server's refusal.
  //
  // Both setState calls are inside the interval callback rather than the effect
  // body on purpose: this effect subscribes to a clock, and the clock is what
  // pushes the updates.
  useEffect(() => {
    const timer = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (cancelling && !canCancelOrder(cancelling, { windowHours, now: at }).allowed) {
        setCancelling(null);
        toast.error(
          `The cancellation window for order ${cancelling.orderNumber} has just closed. ` +
            `It is now with our delivery partner.`
        );
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [cancelling, windowHours]);

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
            // Same policy the API enforces — see lib/order-policy.js. The
            // button only appears when the action would actually succeed.
            //
            // `now` is deliberately the value captured once per render rather
            // than a fresh Date() per order: a list rendered across a window
            // boundary should show one consistent answer, not a button that is
            // live in the first row and expired in the third.
            const cancellable = canCancelOrder(order, { windowHours, now });
            const firstSlug = order.items.find((i) => i.product?.slug)?.product?.slug;

            const statusLine = STATUS_LINES[order.status] ?? STATUS_LINES.PENDING;
            // Paid, still live, and not one of the legacy orders already marked
            // delivered under the old ladder — i.e. exactly the orders sitting
            // with the courier right now.
            const awaitingCourier =
              order.paymentStatus === "PAID" &&
              !["CANCELLED", "DELIVERED"].includes(order.status);

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

                    {/* What happens next, in the shopper's terms. The store has
                        no tracking to show: the parcel goes to an outside
                        delivery partner as soon as the payment clears, and they
                        issue the AWB and send it to the customer themselves (see
                        lib/email-logistics.js). Saying so is more use than a
                        progress bar that could only ever guess.

                        "email or phone" is not vagueness for its own sake — the
                        dispatch email hands the courier desk both contacts and
                        lets them pick, so naming one channel here would be a
                        promise this store is in no position to keep. */}
                    {awaitingCourier ? (
                      <p className="mt-2 flex items-start gap-2 text-[13px] leading-snug text-[#565959]">
                        <Truck className="mt-0.5 size-4 shrink-0 text-[#007600]" />
                        <span>
                          Your parcel is with our delivery partner. They will send an{" "}
                          <span className="font-bold text-[#0f1111]">AWB tracking number</span> to
                          your email or phone — use it on their website to follow your delivery.
                        </span>
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
                    {/* Cancelling closes a fixed time after the order is
                        placed — the courier collects and packs the parcel then,
                        and nothing here can stop it afterwards. The deadline is
                        printed under the button rather than left for the shopper
                        to work out from the order date, because it is the one
                        piece of information that decides whether the button will
                        still be there tomorrow. */}
                    {cancellable.allowed ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setCancelling(order)}
                          className={PILL_SECONDARY}
                        >
                          <XCircle className="size-3.5" />
                          Cancel order
                        </button>
                        <p className="text-center text-[11px] leading-snug text-[#565959]">
                          Cancel within {formatCancelWindow(windowHours)} of placing your order
                          {cancellable.deadline ? (
                            <>
                              {" — by "}
                              <span className="font-bold text-[#0f1111]">
                                {formatCancelDeadline(cancellable.deadline)}
                              </span>
                            </>
                          ) : null}
                          . After that it is with our delivery partner.
                        </p>
                      </>
                    ) : cancellable.expired ? (
                      <p className="rounded-md bg-[#f7fafa] px-3 py-2 text-center text-[11px] leading-snug text-[#565959] ring-1 ring-[#d5d9d9]">
                        The {formatCancelWindow(windowHours)} cancellation window closed on{" "}
                        <span className="font-bold text-[#0f1111]">
                          {formatCancelDeadline(cancellable.deadline)}
                        </span>
                        .
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

                    {/* Policy messaging when no action button is available.
                        The expired case is included: the rail above says when
                        the window shut, this says what that means. */}
                    {!cancellable.allowed &&
                    (cancellable.expired ||
                      ["SHIPPED", "OUT_FOR_DELIVERY"].includes(order.status)) ? (
                      <p className="text-[11px] text-[#565959]">{cancellable.message}</p>
                    ) : null}

                    {/* Refunds already issued for this order */}
                    <OrderRefunds order={order} />

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
                            {formatAddressLines(addr).map((line, i) => (
                              <span key={i} className="block">
                                {line}
                              </span>
                            ))}
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
          // The server refused because the window shut mid-form — inside the
          // minute the tick above had not yet caught. Reload so the list drops
          // the button, and close the sheet: there is nothing to retry.
          onStale={loadOrders}
        />
      ) : null}
    </div>
  );
}
