"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingBag, ArrowLeft, Loader2, Package, Search } from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const STATUS_STYLES = {
  DELIVERED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CONFIRMED: "bg-indigo-50 text-indigo-800 border-indigo-200",
  SHIPPED: "bg-blue-50 text-blue-800 border-blue-200",
  PROCESSING: "bg-amber-50 text-amber-800 border-amber-200",
  CANCELLED: "bg-rose-50 text-rose-800 border-rose-200",
  PENDING: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function AdminOrdersPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function initPage() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (!sessionData.loggedIn || sessionData.session.role !== "ADMIN") {
          toast.error("Unauthorized administrative access.");
          router.push("/login");
          return;
        }
        setAuthChecked(true);
        await fetchOrders();
      } catch (e) {
        console.error("Initial load failure:", e);
      } finally {
        setLoading(false);
      }
    }
    initPage();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/admin/orders");
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (e) {
      toast.error("Failed to load orders.");
    }
  };

  const updateStatus = async (orderId, status) => {
    setSavingId(orderId);
    const toastId = toast.loading("Updating order status...");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to update status.", { id: toastId });
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: data.order.status } : o))
        );
        toast.success(`Order marked ${status}.`, { id: toastId });
      }
    } catch (e) {
      toast.error("Network error.", { id: toastId });
    } finally {
      setSavingId(null);
    }
  };

  if (!authChecked || loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-emerald-700" />
      </main>
    );
  }

  const filtered = orders.filter((o) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.user?.name?.toLowerCase().includes(q) ||
      o.user?.email?.toLowerCase().includes(q)
    );
  });

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      <section className="bg-slate-950 py-8 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-xs font-bold text-white/70 hover:text-white"
          >
            <ArrowLeft className="size-3.5" /> Back to Console
          </Link>
          <PageReveal>
            <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold tracking-tight text-white">
              <ShoppingBag className="size-7" /> Order Management
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Update fulfillment status — changes appear instantly in the customer&apos;s orders page.
            </p>
          </PageReveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        {/* Search */}
        <div className="mb-6 flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 shadow-sm sm:max-w-sm">
          <Search className="size-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by order #, name, or email"
            className="w-full text-sm text-[#0f1111] outline-none placeholder:text-[#565959]"
          />
        </div>

        {filtered.length === 0 ? (
          <FadeIn className="rounded-md border border-border bg-white p-16 text-center shadow-sm">
            <ShoppingBag className="mx-auto size-12 text-slate-300" />
            <p className="mt-4 text-sm font-bold text-slate-700">No orders found.</p>
          </FadeIn>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-450">
                <tr>
                  <th className="p-4">Order</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Items</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50">
                    <td className="p-4">
                      <p className="font-mono font-bold text-emerald-800">{order.orderNumber}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-900">{order.user?.name}</p>
                      <p className="text-[10px] text-slate-400">{order.user?.email}</p>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Package className="size-3.5" />
                        {order.items.length}
                      </span>
                    </td>
                    <td className="p-4 font-extrabold text-slate-900">
                      Rs. {Number(order.total).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span
                        className={`font-bold ${
                          order.paymentStatus === "PAID" ? "text-emerald-700" : "text-amber-600"
                        }`}
                      >
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-[9px] font-bold ${
                          STATUS_STYLES[order.status] || STATUS_STYLES.PENDING
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <select
                        value={order.status}
                        disabled={savingId === order.id}
                        onChange={(e) => updateStatus(order.id, e.target.value)}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600 disabled:opacity-50"
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
