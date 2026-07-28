"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  ArrowRight,
  Clock,
  Package,
  AlertTriangle,
  RefreshCw,
  User,
  KeyRound,
} from "lucide-react";
import { FadeIn, PageReveal, Stagger, StaggerItem } from "@/components/Animated";
import { formatMoney } from "@/lib/currency";

// Amazon's "Your Account" hub is a grid of large cards, each an icon + title +
// one-line description, linking to a section. These are the customer-facing
// destinations this app actually has.
const ACCOUNT_CARDS = [
  {
    href: "/dashboard/orders",
    icon: ShoppingBag,
    title: "Your Orders",
    desc: "Track, return, cancel an order, or buy things again",
  },
  {
    href: "/dashboard/change-password",
    icon: KeyRound,
    title: "Login & Security",
    desc: "Change your password and keep your account secure",
  },
  {
    href: "/dashboard/profile",
    icon: User,
    title: "Your Profile",
    desc: "Edit your name, phone, and personal details",
  },
];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/dashboard");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || "Failed to load dashboard.");
      }
      setData(body);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <p className="text-sm text-[#0f1111] font-medium animate-pulse">Loading your account...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-80 rounded-md border border-rose-200 bg-rose-50 p-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
          <AlertTriangle className="size-6" />
        </span>
        <div>
          <h2 className="text-base font-bold text-rose-900">Unable to load your account</h2>
          <p className="mt-1 text-sm text-rose-700">
            {error || "Could not fetch your data. Please try again."}
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="inline-flex items-center gap-2 rounded bg-rose-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-800"
        >
          <RefreshCw className="size-3.5" />
          Retry
        </button>
      </div>
    );
  }

  const statusColor = (status) => {
    switch (status) {
      case "DELIVERED": return "bg-emerald-50 text-emerald-800";
      case "CONFIRMED": return "bg-indigo-50 text-indigo-800";
      case "SHIPPED": return "bg-blue-50 text-blue-800";
      case "OUT_FOR_DELIVERY": return "bg-cyan-50 text-cyan-800";
      case "PROCESSING": return "bg-amber-50 text-amber-800";
      case "CANCELLED": return "bg-rose-50 text-rose-800";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PageReveal>
        <h1 className="text-[28px] font-bold leading-none text-[#0f1111]">Your Account</h1>
      </PageReveal>

      {/* Account hub cards — Amazon's "Your Account" grid */}
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACCOUNT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <StaggerItem key={card.href}>
              <Link
                href={card.href}
                className="group flex h-full items-start gap-4 rounded-lg border border-[#d5d9d9] bg-white p-5 shadow-sm transition hover:border-[#adb1b8] hover:shadow-md"
              >
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#f0f2f2] text-[#232f3e] ring-1 ring-[#d5d9d9] transition group-hover:bg-[#eaeded]">
                  <Icon className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-[16px] font-bold text-[#0f1111] group-hover:text-[#c7511f]">
                    {card.title}
                  </p>
                  <p className="mt-1 text-[13px] leading-5 text-[#565959]">{card.desc}</p>
                </div>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>

      {/* Recent orders panel */}
      <FadeIn className="rounded-lg border border-[#d5d9d9] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between border-b border-[#d5d9d9] pb-3">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#0f1111]">
            <Clock className="size-4 text-[#0f1111]" />
            Recent Orders
          </h2>
          <Link
            href="/dashboard/orders"
            className="flex items-center gap-1 text-[13px] font-semibold text-[#007185] transition hover:text-[#c7511f] hover:underline"
          >
            View all <ArrowRight className="size-3" />
          </Link>
        </div>

        {data.recentOrders.length === 0 ? (
          <div className="py-8 text-center">
            <Package className="mx-auto size-10 text-[#aab7b8]" />
            <p className="mt-3 text-xs text-[#565959]">
              No orders yet.{" "}
              <Link href="/products" className="font-semibold text-[#007185] hover:text-[#c7511f] hover:underline">
                Shop now
              </Link>
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#d5d9d9]">
            {data.recentOrders.map((order) => (
              <Link
                key={order.id}
                href="/dashboard/orders"
                className="flex items-center justify-between gap-3 py-3 transition hover:bg-[#f7fafa]"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold text-[#0f1111]">
                    {order.orderNumber}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#565959]">
                    {new Date(order.createdAt).toLocaleDateString("en-AE", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-extrabold text-[#0f1111]">
                    {formatMoney(order.total)}
                  </p>
                  <span
                    className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold ${statusColor(order.status)}`}
                  >
                    {order.status.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </FadeIn>
    </div>
  );
}
