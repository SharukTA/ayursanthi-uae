"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Package,
  ChevronDown,
  ChevronUp,
  MapPin,
  CreditCard,
} from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";

const STATUS_STYLES = {
  DELIVERED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CONFIRMED: "bg-indigo-50 text-indigo-800 border-indigo-200",
  SHIPPED: "bg-blue-50 text-blue-800 border-blue-200",
  PROCESSING: "bg-amber-50 text-amber-800 border-amber-200",
  CANCELLED: "bg-rose-50 text-rose-800 border-rose-200",
  PENDING: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetch("/api/user/orders")
      .then((r) => r.json())
      .then((data) => setOrders(data.orders || []))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id) => setExpandedId((prev) => (prev === id ? null : id));

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <p className="animate-pulse text-sm font-medium text-white">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageReveal>
        <h1 className="text-2xl font-bold text-white">My Orders</h1>
        <p className="mt-1 text-sm text-[#3f4545]">
          View and track all your purchase history.
        </p>
      </PageReveal>

      {orders.length === 0 ? (
        <FadeIn className="rounded-md border border-border bg-white p-16 text-center shadow-sm">
          <ShoppingBag className="mx-auto size-12 text-[#aab7b8]" />
          <h3 className="mt-4 text-sm font-bold text-[#0f1111]">No orders yet</h3>
          <p className="mt-1 text-xs text-[#565959]">
            Your order history will appear here after your first purchase.
          </p>
          <Link
            href="/products"
            className="mt-5 inline-block text-xs font-bold text-[#0f1111] hover:underline"
          >
            Browse Products →
          </Link>
        </FadeIn>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => {
            const addr = order.addressSnapshot;
            const isOpen = expandedId === order.id;
            const statusClass = STATUS_STYLES[order.status] ?? STATUS_STYLES.PENDING;

            return (
              <FadeIn
                key={order.id}
                className="overflow-hidden rounded-md border border-border bg-white shadow-sm"
              >
                {/* Order header row — clickable */}
                <button
                  className="flex w-full items-center justify-between gap-3 p-5 text-left transition hover:bg-[#f8fafc]"
                  onClick={() => toggle(order.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#232f3e] text-white">
                      <Package className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-[#0f1111]">
                        {order.orderNumber}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#565959]">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                        {" · "}
                        {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={`hidden rounded border px-2 py-0.5 text-[9px] font-bold sm:inline-flex ${statusClass}`}
                    >
                      {order.status}
                    </span>
                    <p className="text-sm font-extrabold text-[#0f1111]">
                      Rs. {Number(order.total).toLocaleString()}
                    </p>
                    {isOpen ? (
                      <ChevronUp className="size-4 shrink-0 text-[#0f1111]" />
                    ) : (
                      <ChevronDown className="size-4 shrink-0 text-[#0f1111]" />
                    )}
                  </div>
                </button>

                {/* Expanded detail panel */}
                {isOpen && (
                  <div className="flex flex-col gap-5 border-t border-[#d5d9d9] p-5">
                    {/* Status badge (mobile) */}
                    <div className="flex items-center gap-2 sm:hidden">
                      <span
                        className={`rounded border px-2 py-0.5 text-[9px] font-bold ${statusClass}`}
                      >
                        {order.status}
                      </span>
                      <span className="text-[9px] font-bold text-[#565959]">
                        Payment: {order.paymentStatus}
                      </span>
                    </div>

                    {/* Items list */}
                    <div>
                      <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#565959]">
                        Order Items
                      </h4>
                      <div className="divide-y divide-[#d5d9d9]">
                        {order.items.map((item) => {
                          const slug = item.product?.slug;
                          const RowTag = slug ? Link : "div";
                          const rowProps = slug
                            ? {
                                href: `/products/${slug}`,
                                className:
                                  "flex items-center gap-3 py-3 transition hover:bg-[#f8fafc]",
                              }
                            : { className: "flex items-center gap-3 py-3" };

                          return (
                            <RowTag key={item.id} {...rowProps}>
                              {item.product?.images?.[0]?.url &&
                              item.product.images[0].mediaType === "VIDEO" ? (
                                <video
                                  src={item.product.images[0].url}
                                  muted
                                  loop
                                  autoPlay
                                  playsInline
                                  preload="metadata"
                                  className="size-14 shrink-0 rounded border border-[#d5d9d9] object-cover"
                                />
                              ) : item.product?.images?.[0]?.url ? (
                                <img
                                  src={item.product.images[0].url}
                                  alt={item.productName}
                                  className="size-14 shrink-0 rounded border border-[#d5d9d9] object-cover"
                                />
                              ) : (
                                <div className="flex size-14 shrink-0 items-center justify-center rounded border border-[#d5d9d9] bg-[#f8fafc]">
                                  <Package className="size-5 text-[#aab7b8]" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-[#0f1111] truncate">
                                  {item.productName}
                                </p>
                                <p className="mt-0.5 text-[11px] text-[#565959]">
                                  Qty: {item.quantity} × Rs.{" "}
                                  {Number(item.price).toLocaleString()}
                                </p>
                              </div>
                              <p className="shrink-0 text-xs font-extrabold text-[#0f1111]">
                                Rs. {Number(item.total).toLocaleString()}
                              </p>
                            </RowTag>
                          );
                        })}
                      </div>
                    </div>

                    {/* Price breakdown */}
                    <div className="rounded-md border border-[#d5d9d9] bg-[#f8fafc] p-4">
                      <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#565959]">
                        Price Breakdown
                      </h4>
                      <div className="grid gap-2 text-xs">
                        <div className="flex justify-between text-[#3f4545]">
                          <span>Subtotal</span>
                          <span className="font-bold text-[#0f1111]">
                            Rs. {Number(order.subtotal).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-[#3f4545]">
                          <span>GST (18%)</span>
                          <span className="font-bold text-[#0f1111]">
                            Rs. {Number(order.tax).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-[#3f4545]">
                          <span>Shipping</span>
                          <span className="font-bold text-[#0f1111]">
                            {Number(order.shipping) === 0
                              ? "FREE"
                              : `Rs. ${Number(order.shipping).toLocaleString()}`}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-[#d5d9d9] pt-2 font-extrabold text-[#0f1111]">
                          <span>Total Paid</span>
                          <span>Rs. {Number(order.total).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

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
                    <div className="flex items-center gap-2 rounded-md border border-[#d5d9d9] bg-[#f8fafc] p-3 text-xs text-[#3f4545]">
                      <CreditCard className="size-4 text-[#0f1111] shrink-0" />
                      <span>
                        Payment Status:{" "}
                        <span
                          className={`font-bold ${
                            order.paymentStatus === "PAID"
                              ? "text-[#0f1111]"
                              : "text-amber-600"
                          }`}
                        >
                          {order.paymentStatus}
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </FadeIn>
            );
          })}
        </div>
      )}
    </div>
  );
}
