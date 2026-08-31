"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ShoppingBag,
  ArrowLeft,
  Download,
  Loader2,
  Package,
  Search,
  Send,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useConfirm } from "@/components/ConfirmDialog";
import { AdminCancelOrderDialog } from "@/components/AdminCancelOrderDialog";
import {
  canCancelOrder,
  formatCancelDeadline,
  formatCancelWindow,
  needsLogisticsDispatch,
} from "@/lib/order-policy";
import { useSiteSettings } from "@/components/SettingsProvider";
import { formatMoney } from "@/lib/currency";

// Read-only badge colours. PENDING and CONFIRMED are the only two the store
// still writes; the rest are here so orders placed under the old admin-driven
// fulfilment ladder keep rendering correctly.
const STATUS_STYLES = {
  DELIVERED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CONFIRMED: "bg-indigo-50 text-indigo-800 border-indigo-200",
  SHIPPED: "bg-blue-50 text-blue-800 border-blue-200",
  // A shade along from SHIPPED — same journey, one step later.
  OUT_FOR_DELIVERY: "bg-cyan-50 text-cyan-800 border-cyan-200",
  PROCESSING: "bg-amber-50 text-amber-800 border-amber-200",
  CANCELLED: "bg-rose-50 text-rose-800 border-rose-200",
  PENDING: "bg-slate-100 text-slate-600 border-slate-200",
};

// Underscored enum values read badly in a badge. Everything else is a single
// word and passes through unchanged.
const statusLabel = (status) => status.replace(/_/g, " ");

export default function AdminOrdersPage() {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [authChecked, setAuthChecked] = useState(false);
  // Order whose cancellation sheet is open, or null when none is.
  const [cancelling, setCancelling] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [query, setQuery] = useState("");
  // The store is bound by the same cancellation window as the customer — see
  // canCancelOrder() in lib/order-policy.js for why. Seeded by SettingsProvider,
  // so this table and the API read the identical value.
  const { order_cancel_window_hours: windowHours } = useSiteSettings();
  // Ticked so a row whose window runs out while the console is open loses its
  // button, instead of offering a click the API will refuse.
  const [now, setNow] = useState(() => Date.now());

  // One timer, two jobs — see the twin of this in dashboard/orders. The table
  // re-renders on the new instant, and an open cancellation sheet is shut if its
  // order leaves the window while it is open: the store is held to the same
  // deadline, so the sheet goes the same way the button does.
  useEffect(() => {
    const timer = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (cancelling && !canCancelOrder(cancelling, { windowHours, now: at }).allowed) {
        setCancelling(null);
        toast.error(`The cancellation window for ${cancelling.orderNumber} has just closed.`);
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [cancelling, windowHours]);

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

  /**
   * Fold a cancelled order back into the table.
   *
   * paymentStatus and refundedTotal ride along with the status: cancelling a
   * paid order refunds it, so the Payment column has to reflect that without a
   * reload.
   */
  const applyCancellation = (updated) =>
    setOrders((prev) =>
      prev.map((o) =>
        o.id === updated.id
          ? {
              ...o,
              status: updated.status,
              paymentStatus: updated.paymentStatus,
              refundedTotal: updated.refundedTotal,
            }
          : o
      )
    );

  /**
   * Re-send one order's dispatch details to the logistics inbox.
   *
   * The courier desk works from that mailbox, so an order the email never
   * reached is an order nobody outside this building knows to ship. This is the
   * only recovery for that, which is why it reports the outcome instead of
   * firing and forgetting the way the automatic send does.
   */
  const resendLogistics = async (order, { force = false } = {}) => {
    if (
      force &&
      !(await confirm({
        title: "Send this dispatch again?",
        description:
          `The courier desk was already sent ${order.orderNumber} and may have booked it. ` +
          "Sending again can put a second parcel on the road for the same order.",
        confirmLabel: "Send again",
        cancelLabel: "Leave it",
      }))
    ) {
      return;
    }

    setSavingId(order.id);
    const toastId = toast.loading("Sending to logistics...");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/logistics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to send to logistics.", { id: toastId });
        return;
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, logisticsNotifiedAt: data.logisticsNotifiedAt } : o
        )
      );
      toast.success(data.message, { id: toastId });
    } catch (e) {
      toast.error("Network error.", { id: toastId });
    } finally {
      setSavingId(null);
    }
  };

  /**
   * Download the orders CSV, carrying the current search term so the file
   * matches what the table is showing. A plain navigation rather than a fetch —
   * the response is an attachment, so the browser's own download handling is
   * both simpler and able to cope with a file too large to hold in memory.
   */
  const exportCsv = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    const qs = params.toString();
    window.location.href = `/api/admin/orders/export${qs ? `?${qs}` : ""}`;
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
              Orders confirm themselves the moment payment clears, and the courier takes it from
              there — track a parcel by its AWB number with the delivery partner, not here.
              Cancelling puts stock back and refunds anything already paid, and is only possible
              within {formatCancelWindow(windowHours)} of an order being placed: after that the
              courier has collected the parcel, so a cancellation here would refund goods already
              on their way. Change that window in{" "}
              <Link href="/admin/settings" className="font-bold text-white underline">
                Site Settings
              </Link>
              .
            </p>
          </PageReveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        {/* Search + export */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 shadow-sm sm:max-w-sm sm:flex-1">
            <Search className="size-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by order #, name, or email"
              className="w-full text-sm text-[#0f1111] outline-none placeholder:text-[#565959]"
            />
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={orders.length === 0}
            title="Download every order with its full shipping address as a CSV"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="size-4 text-slate-400" />
            Export CSV{query.trim() ? " (filtered)" : ""}
          </button>
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
                  <th className="p-4">Dispatch</th>
                  <th className="p-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((order) => {
                  // The store's cancel button lives and dies by the same verdict
                  // the customer's does. Computed per row so the reason a button
                  // is missing can be printed in its place.
                  const cancellable = canCancelOrder(order, { windowHours, now });
                  return (
                  <tr key={order.id} className="hover:bg-slate-50/50">
                    <td className="p-4">
                      <p className="font-mono font-bold text-emerald-800">{order.orderNumber}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString("en-AE", {
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
                      {formatMoney(order.total)}
                    </td>
                    <td className="p-4">
                      <span
                        className={`font-bold ${
                          order.paymentStatus === "PAID"
                            ? "text-emerald-700"
                            : order.paymentStatus === "REFUNDED"
                              ? "text-slate-700"
                              : "text-amber-600"
                        }`}
                      >
                        {order.paymentStatus}
                      </span>
                      {Number(order.refundedTotal) > 0 ? (
                        <p className="mt-0.5 text-[10px] font-bold text-slate-500">
                          {formatMoney(order.refundedTotal)} refunded
                        </p>
                      ) : null}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-[9px] font-bold ${
                          STATUS_STYLES[order.status] || STATUS_STYLES.PENDING
                        }`}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </td>

                    {/* Whether the courier desk has been told to ship this.
                        Its own column because it is the one part of the order
                        that no other screen reveals: an order can look paid,
                        confirmed and perfectly healthy while the dispatch email
                        that actually moves the parcel never arrived. */}
                    <td className="p-4">
                      {order.logisticsNotifiedAt ? (
                        <>
                          <span className="inline-flex rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
                            SENT
                          </span>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {new Date(order.logisticsNotifiedAt).toLocaleDateString("en-AE", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                          {/* Deliberately quiet: re-sending books a second
                              parcel, so it is a text link next to a confirm,
                              not a button competing with the one above. */}
                          <button
                            type="button"
                            onClick={() => resendLogistics(order, { force: true })}
                            disabled={savingId === order.id}
                            className="mt-1 text-[10px] font-semibold text-slate-400 underline hover:text-slate-600 disabled:opacity-50"
                          >
                            Send again
                          </button>
                        </>
                      ) : needsLogisticsDispatch(order) ? (
                        <>
                          <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-800">
                            <TriangleAlert className="size-3" />
                            NOT SENT
                          </span>
                          <button
                            type="button"
                            onClick={() => resendLogistics(order)}
                            disabled={savingId === order.id}
                            className="mt-1 flex items-center gap-1 rounded-md border border-rose-700 px-2 py-1 text-[11px] font-bold text-rose-800 hover:bg-rose-50 disabled:opacity-50"
                          >
                            <Send className="size-3" />
                            Send now
                          </button>
                        </>
                      ) : (
                        // Nothing is owed to logistics: the order is unpaid,
                        // cancelled, or predates the automatic handoff.
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
                    </td>

                    <td className="p-4">
                      {cancellable.allowed ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setCancelling(order)}
                            disabled={savingId === order.id}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-700 px-2 py-1 text-[11px] font-bold text-rose-800 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <XCircle className="size-3" />
                            Cancel order
                          </button>
                          {/* The deadline, not a countdown: it is the fact an
                              admin needs when a customer phones asking to be
                              let out of an order. */}
                          {cancellable.deadline ? (
                            <p className="mt-1 max-w-[9.5rem] text-[9px] leading-snug text-slate-400">
                              Until {formatCancelDeadline(cancellable.deadline)}
                            </p>
                          ) : null}
                        </>
                      ) : cancellable.expired ? (
                        <span className="inline-flex max-w-[9.5rem] items-start gap-1 text-[9px] leading-snug text-slate-400">
                          <TriangleAlert className="mt-px size-3 shrink-0 text-slate-300" />
                          {formatCancelWindow(windowHours)} window closed — with the courier
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SiteFooter />

      {cancelling ? (
        <AdminCancelOrderDialog
          order={cancelling}
          onClose={() => setCancelling(null)}
          onCancelled={applyCancellation}
          // Refused because the window shut mid-form. applyCancellation() takes
          // an updated order and there is none, so the table is reloaded
          // instead — it comes back with the row's button already gone.
          onStale={fetchOrders}
        />
      ) : null}
      {confirmDialog}
    </main>
  );
}
