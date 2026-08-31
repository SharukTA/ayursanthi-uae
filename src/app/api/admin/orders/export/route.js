/**
 * Admin CSV export of orders and their shipping addresses.
 *
 * One row per order: order and payment details, the account behind it, and the
 * full shipping address broken into columns. The address comes from
 * `Order.addressSnapshot`, which is written on every order at checkout and
 * never rewritten afterwards — so an export of March's orders gives the address
 * each parcel actually went to, not wherever that customer lives now.
 *
 * Every filter is optional and they combine with AND. With none, the whole
 * order history is returned, which is the "give me everything" case.
 *
 *   GET /api/admin/orders/export
 *     ?status=SHIPPED,OUT_FOR_DELIVERY   order status, comma-separated
 *     &payment=PAID                      payment status, comma-separated
 *     &from=2026-08-01                   createdAt >= this date (inclusive)
 *     &to=2026-08-31                     createdAt <= end of this day
 *     &q=AYS-1042                        order number, customer name or email
 */

import { prisma } from "@/lib/prisma";
import { requireAdmin, ORDER_STATUSES } from "@/lib/admin-api";
import { ADDRESS_EXPORT_COLUMNS, flattenAddressSnapshot } from "@/lib/address";
import { toCsv, csvResponse } from "@/lib/csv";
import { paymentMethodLabel, cancelReasonLabel } from "@/lib/order-policy";

export const runtime = "nodejs";

// Keep in sync with the PaymentStatus enum in prisma/schema.prisma.
const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"];

/**
 * Columns that describe the order itself. The address columns are appended to
 * these, so adding a field to ADDRESS_EXPORT_COLUMNS widens the export with no
 * change here.
 */
const ORDER_EXPORT_COLUMNS = [
  ["orderNumber", "Order Number"],
  ["orderDate", "Order Date"],
  ["status", "Status"],
  ["paymentStatus", "Payment Status"],
  ["paymentMethod", "Payment Method"],
  ["subtotal", "Subtotal (AED)"],
  ["shipping", "Delivery (AED)"],
  ["total", "Total (AED)"],
  ["refundedTotal", "Refunded (AED)"],
  ["itemCount", "Units"],
  ["items", "Items"],
  ["accountName", "Account Name"],
  ["accountEmail", "Account Email"],
  ["accountPhone", "Account Phone"],
  ["dispatchedAt", "Dispatched To Logistics"],
  ["cancelledAt", "Cancelled At"],
  ["cancelledBy", "Cancelled By"],
  ["cancelReason", "Cancellation Reason"],
];

const EXPORT_COLUMNS = [...ORDER_EXPORT_COLUMNS, ...ADDRESS_EXPORT_COLUMNS];

/**
 * Read a comma-separated query param and keep only the values that are real
 * members of `allowed`.
 *
 * Silently dropping unknown values rather than erroring is deliberate: the
 * filter is a convenience on a read-only export, and a stale bookmark naming a
 * status that no longer exists should still return the rest, not a 400.
 */
function enumFilter(raw, allowed) {
  if (!raw) return null;
  const wanted = raw
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter((part) => allowed.includes(part));
  return wanted.length ? wanted : null;
}

/**
 * Parse a `from`/`to` date param.
 *
 * `to` is pushed to the end of its day so that `to=2026-08-31` includes orders
 * placed that afternoon — a date-only bound that excluded most of its own day
 * would surprise every admin who typed it.
 */
function parseDate(raw, { endOfDay = false } = {}) {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    parsed.setHours(23, 59, 59, 999);
  }
  return parsed;
}

/** Decimal columns arrive as Prisma Decimal; a spreadsheet wants a bare number. */
const money = (v) => (v === null || v === undefined ? "" : String(v));

/** ISO 8601 sorts correctly as text in every spreadsheet. Locale strings do not. */
const stamp = (d) => (d ? new Date(d).toISOString() : "");

export async function GET(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const params = request.nextUrl.searchParams;

  const statuses = enumFilter(params.get("status"), ORDER_STATUSES);
  const payments = enumFilter(params.get("payment"), PAYMENT_STATUSES);
  const from = parseDate(params.get("from"));
  const to = parseDate(params.get("to"), { endOfDay: true });
  const q = (params.get("q") || "").trim();

  const where = {
    ...(statuses ? { status: { in: statuses } } : {}),
    ...(payments ? { paymentStatus: { in: payments } } : {}),
    ...(from || to
      ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
    // Mirrors the search box on the admin orders page so the button exports
    // what the admin is currently looking at.
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const orders = await prisma.order.findMany({
    where,
    // Oldest first: an export is usually read or appended as a ledger, and the
    // admin table's newest-first order is a screen convention, not a file one.
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      items: { select: { productName: true, quantity: true } },
      // paymentMethodLabel() derives card-vs-cash from these rows.
      payments: { select: { provider: true } },
    },
  });

  const rows = orders.map((order) => ({
    orderNumber: order.orderNumber,
    orderDate: stamp(order.createdAt),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: paymentMethodLabel(order),
    subtotal: money(order.subtotal),
    shipping: money(order.shipping),
    total: money(order.total),
    refundedTotal: money(order.refundedTotal),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    items: order.items.map((item) => `${item.quantity} x ${item.productName}`).join("; "),
    accountName: order.user?.name ?? "",
    accountEmail: order.user?.email ?? "",
    accountPhone: order.user?.phone ?? "",
    dispatchedAt: stamp(order.logisticsNotifiedAt),
    cancelledAt: stamp(order.cancelledAt),
    cancelledBy: order.cancelledBy ?? "",
    cancelReason: order.cancelReason ? cancelReasonLabel(order.cancelReason) : "",
    ...flattenAddressSnapshot(order.addressSnapshot),
  }));

  const today = new Date().toISOString().slice(0, 10);
  return csvResponse(toCsv(rows, EXPORT_COLUMNS), `ayurshoppee-orders-${today}.csv`);
}
