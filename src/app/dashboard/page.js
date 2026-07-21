"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Wallet,
  Users,
  IndianRupee,
  ArrowRight,
  Clock,
  TrendingUp,
  Gift,
  Package,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { FadeIn, PageReveal, Stagger, StaggerItem } from "@/components/Animated";
import { NextDrawProgress } from "@/components/NextDrawProgress";

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
        <p className="text-sm text-white font-medium animate-pulse">Loading your dashboard...</p>
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
          <h2 className="text-base font-bold text-rose-900">Unable to load dashboard</h2>
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

  const stats = [
    {
      label: "Total Orders",
      value: data.totalOrders,
      icon: ShoppingBag,
      color: "bg-indigo-100 text-indigo-800",
      href: "/dashboard/orders",
    },
    {
      label: "Total Spent",
      value: `Rs. ${Number(data.totalSpent).toLocaleString()}`,
      icon: IndianRupee,
      color: "bg-emerald-100 text-emerald-800",
      href: "/dashboard/orders",
    },
    {
      label: "Wallet Balance",
      value: `Rs. ${Number(data.walletBalance).toLocaleString()}`,
      icon: Wallet,
      color: "bg-amber-100 text-amber-800",
      href: "/dashboard/wallet",
    },
    {
      label: "Referrals",
      value: data.referralsCount,
      icon: Users,
      color: "bg-rose-100 text-rose-800",
      href: "/dashboard/referrals",
    },
  ];

  const statusColor = (status) => {
    switch (status) {
      case "DELIVERED": return "bg-emerald-50 text-emerald-800";
      case "CONFIRMED": return "bg-indigo-50 text-indigo-800";
      case "SHIPPED": return "bg-blue-50 text-blue-800";
      case "PROCESSING": return "bg-amber-50 text-amber-800";
      case "CANCELLED": return "bg-rose-50 text-rose-800";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PageReveal>
        <h1 className="text-2xl font-bold text-white">My Dashboard</h1>
        <p className="mt-1 text-sm text-[#3f4545]">
          Overview of your orders, wallet, and referral activity.
        </p>
      </PageReveal>

      {/* Stats grid */}
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <StaggerItem key={stat.label}>
              <Link
                href={stat.href}
                className="group flex items-center justify-between rounded-md border border-border bg-white p-5 shadow-sm transition hover:border-[#adb1b8] hover:shadow-md"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#565959]">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-xl font-extrabold text-[#0f1111]">{stat.value}</p>
                </div>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[#232f3e] text-white">
                  <Icon className="size-5" />
                </span>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>

      {/* When is the next gift draw — community progress toward the milestone. */}
      <NextDrawProgress tone="light" />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <FadeIn className="rounded-md border border-border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-[#d5d9d9] pb-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#0f1111]">
              <Clock className="size-4 text-[#0f1111]" />
              Recent Orders
            </h2>
            <Link
              href="/dashboard/orders"
              className="flex items-center gap-1 text-xs font-semibold text-[#0f1111] hover:underline"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          </div>

          {data.recentOrders.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="mx-auto size-10 text-[#aab7b8]" />
              <p className="mt-3 text-xs text-[#565959]">
                No orders yet.{" "}
                <Link href="/products" className="font-semibold text-[#0f1111] hover:underline">
                  Shop now
                </Link>
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#d5d9d9]">
              {data.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-mono text-xs font-bold text-[#0f1111]">
                      {order.orderNumber}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#565959]">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-extrabold text-[#0f1111]">
                      Rs. {Number(order.total).toLocaleString()}
                    </p>
                    <span
                      className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold ${statusColor(order.status)}`}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </FadeIn>

        {/* Wallet Activity */}
        <FadeIn className="rounded-md border border-border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-[#d5d9d9] pb-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#0f1111]">
              <TrendingUp className="size-4 text-[#0f1111]" />
              Wallet Activity
            </h2>
            <Link
              href="/dashboard/wallet"
              className="flex items-center gap-1 text-xs font-semibold text-[#0f1111] hover:underline"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="mb-4 flex items-center justify-between rounded-md border-2 border-[#d5d9d9] bg-[#f8fafc] p-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#565959]">
                Available Balance
              </p>
              <p className="text-xl font-extrabold text-[#0f1111]">
                Rs. {Number(data.walletBalance).toLocaleString()}
              </p>
            </div>
            <Gift className="size-8 text-[#0f1111]" />
          </div>

          {data.recentTransactions.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#565959]">
              No transactions yet. Earn from referrals!
            </p>
          ) : (
            <div className="divide-y divide-[#d5d9d9]">
              {data.recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-start justify-between py-2.5">
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-xs font-medium text-[#0f1111]">
                      {tx.description || tx.type}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#565959]">
                      {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-extrabold ${
                      tx.type === "CREDIT" ? "text-[#0f1111]" : "text-rose-600"
                    }`}
                  >
                    {tx.type === "CREDIT" ? "+" : "-"}Rs.{" "}
                    {Number(tx.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </FadeIn>
      </div>
    </div>
  );
}
