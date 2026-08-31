/**
 * Order lifecycle and cancellation policy — the single source of truth for
 * "where can this order go next, can it be cancelled, and what happens to the
 * money".
 *
 * The store does not run a fulfilment ladder. Delivery is handed to an outside
 * courier the moment payment clears (see lib/email-logistics.js), and the parcel
 * is tracked by AWB number at the courier's own desk, not here. So an order has
 * exactly three states worth anything:
 *
 *   PENDING    the checkout was started but the money has not cleared. A
 *              reservation, nothing more.
 *   CONFIRMED  the payment succeeded. Written by confirmPaidOrder() in
 *              lib/order-payment.js and by nothing else — no screen in this app
 *              advances an order past it.
 *   CANCELLED  the customer or the store pulled it. Stock goes back, money goes
 *              back. See lib/order-actions.js.
 *
 * PROCESSING, SHIPPED, OUT_FOR_DELIVERY and DELIVERED remain in the OrderStatus
 * enum only because orders placed under the old admin-driven ladder still carry
 * them. Nothing writes them any more; every screen must still be able to read
 * and display them.
 *
 * Deliberately free of any Prisma import so the customer UI can run the exact
 * same eligibility checks the API enforces: the dashboard hides a button using
 * these helpers, and the route re-runs them before writing anything. The API is
 * always the authority; the UI copy just avoids dead-end clicks.
 *
 * The store does not accept returns or replacements. CANCEL is the only way out
 * of an order, and it closes a fixed number of hours after the order is placed —
 * the point at which the courier collects and packs the parcel. That window is
 * admin-editable (`order_cancel_window_hours`, default 24) and binds the store as
 * well as the shopper, because neither can stop a parcel that has already gone.
 */

// When the automatic dispatch handoff to the logistics inbox went live.
//
// Orders older than this were dispatched by hand and will never carry a
// `logisticsNotifiedAt` stamp, so without a cutoff the admin list would flag the
// entire back catalogue as "never sent to logistics" and the flag would mean
// nothing. Only orders placed from here on are expected to have one.
//
// Lives in this file rather than beside the sender in lib/email-logistics.js
// because the admin order list is a client component and that module pulls in
// Prisma. Same reason the rest of this file exists.
export const LOGISTICS_DISPATCH_SINCE = new Date("2026-08-25T00:00:00.000Z");

/**
 * Whether an order should have reached the courier desk by now and hasn't.
 *
 * True only for orders that are genuinely stuck: paid for, not cancelled, and
 * placed after the handoff existed. That combination means the money is in, the
 * goods are committed, and nobody outside has been told to ship them — the one
 * state in this system that no other screen would reveal.
 *
 * @param {{paymentStatus: string, status: string, createdAt: string|Date, logisticsNotifiedAt: string|Date|null}} order
 */
export function needsLogisticsDispatch(order) {
  if (!order || order.logisticsNotifiedAt) return false;
  if (order.paymentStatus !== "PAID") return false;
  if (order.status === "CANCELLED") return false;
  return new Date(order.createdAt) >= LOGISTICS_DISPATCH_SINCE;
}

// Fulfillment states a customer may still cancel from.
//
// The live ladder is only PENDING -> CONFIRMED, so those two are what this
// really guards. PROCESSING is kept for the orders already sitting in that state
// from when the store drove its own fulfilment ladder — dropping it would strand
// them as uncancellable for no reason. SHIPPED, OUT_FOR_DELIVERY and DELIVERED
// are absent for the reason they always were: the parcel is already gone.
export const CANCELLABLE_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING"];

/**
 * How long after an order is placed it may still be cancelled, in hours.
 *
 * Only the fallback. The live value is the `order_cancel_window_hours` setting,
 * which an admin edits in /admin/settings — see getCancelWindowHours() in
 * lib/settings.js for the server read, and useSiteSettings() for the client one.
 *
 * This is an operational boundary rather than a policy preference: the courier
 * collects and packs the parcel once the order has been standing for this long
 * (see lib/email-logistics.js), so past the window the goods are already out of
 * the building and a "cancellation" would be a recall nobody here can perform.
 * That is also why it binds the store as well as the shopper.
 */
export const DEFAULT_CANCEL_WINDOW_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

/**
 * The cancellation window as a usable number of hours.
 *
 * Guarded on every read rather than trusted from the settings table, for the
 * reason the gift schedule is: this is the read the policy actually goes
 * through, and it must not depend on the admin form having been the only writer.
 * A blank, non-numeric or zero/negative value falls back to the default — a
 * window of zero would silently close cancellation for the whole store, which is
 * far too large a consequence for a typo.
 */
export function normalizeCancelWindowHours(raw) {
  const hours = Number(raw);
  return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_CANCEL_WINDOW_HOURS;
}

/**
 * The window in words, for the notes shown beside a cancel button: "24 hours",
 * "2 days", "1 hour". Whole multiples of a day above one read as days because
 * "168 hours" is a number the reader has to do arithmetic on; 24 itself stays in
 * hours because that is how the store has always worded it.
 */
export function formatCancelWindow(raw) {
  const hours = normalizeCancelWindowHours(raw);
  if (hours > 24 && hours % 24 === 0) {
    const days = hours / 24;
    return `${days} days`;
  }
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * The instant this order's cancellation window shuts, or null if the order
 * carries no usable placement date.
 *
 * Measured from createdAt — the moment of booking — and not from payment: the
 * order is created before the shopper reaches Stripe, so anchoring on payment
 * would hand a shopper who sat on the payment page a fresh window, and would
 * leave a never-paid order cancellable forever.
 */
export function cancelWindowEndsAt(order, windowHours) {
  const placedAt = new Date(order?.createdAt ?? NaN);
  if (Number.isNaN(placedAt.getTime())) return null;
  return new Date(placedAt.getTime() + normalizeCancelWindowHours(windowHours) * HOUR_MS);
}

/**
 * The oldest `createdAt` still inside the window, for a database WHERE clause.
 *
 * The mirror image of cancelWindowEndsAt(): an order is cancellable when
 * `now < createdAt + window`, which rearranges to `createdAt > now - window`.
 * Strictly greater, matching the half-open rule in canCancelOrder() — an order
 * placed exactly one window ago is already out.
 *
 * Exists so the write-time guard in lib/order-actions.js can re-assert the very
 * same condition inside its transaction, in SQL, rather than restating the
 * arithmetic and drifting from it by an hour or a boundary.
 */
export function cancelWindowCutoff(windowHours, now) {
  const at = now == null ? Date.now() : new Date(now).getTime();
  return new Date(at - normalizeCancelWindowHours(windowHours) * HOUR_MS);
}

/**
 * "31 December 2026 at 1:00 PM" — a deadline, worded for the customer.
 *
 * Fixed to Asia/Dubai for the reason the draw formatters are: the deadline is a
 * fact about the store's day, and rendering it in the viewer's own zone would
 * tell a shopper abroad an hour the store does not recognise. A local copy
 * rather than an import of formatDrawDateTime, because this module stays free of
 * imports so the customer UI can run the same checks the API enforces.
 */
export function formatCancelDeadline(value) {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  const date = at.toLocaleDateString("en-AE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dubai",
  });
  const time = at.toLocaleTimeString("en-AE", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Dubai",
  });
  return `${date} at ${time}`;
}

/**
 * Orders the customer should never be shown.
 *
 * The order is created before the shopper reaches Stripe, so every abandoned or
 * declined payment leaves a cancelled, never-paid order behind. Those are
 * bookkeeping, not history — the shopper backed out of a payment page, and
 * listing three of them as "cancelled orders" only prompts a support ticket
 * asking who cancelled them.
 *
 * Deliberately narrow: it matches only orders that are cancelled AND were never
 * paid AND went through the online gateway. A legacy Cash-on-Delivery order the
 * shopper really did place and really did have cancelled stays in their history,
 * where it belongs.
 */
export const CUSTOMER_VISIBLE_ORDERS = {
  NOT: {
    AND: [
      { status: "CANCELLED" },
      { paymentStatus: "FAILED" },
      { payments: { some: { provider: "stripe" } } },
    ],
  },
};

/**
 * Was this order paid online?
 *
 * Every order placed through the current checkout is, so this is really a
 * question about history: Cash on Delivery was retired, but the orders taken
 * under it are still in the database and their invoices must keep saying what
 * actually happened rather than being quietly rewritten.
 *
 * Derived from the payment rows rather than stored on the order, so the order
 * must have been loaded with `payments`. A Stripe row is the marker.
 */
export function isOnlinePaidOrder(order) {
  return (order?.payments ?? []).some((payment) => payment.provider === "stripe");
}

/**
 * How the order was paid, in words, for anything the customer or the admin
 * reads — emails, invoices. Same input requirement as isOnlinePaidOrder(), and
 * the same reason for still having two answers.
 */
export function paymentMethodLabel(order) {
  return isOnlinePaidOrder(order) ? "Paid online (card or wallet)" : "Cash on Delivery";
}

export const CANCEL_REASONS = [
  { value: "ORDERED_BY_MISTAKE", label: "Ordered by mistake" },
  { value: "FOUND_CHEAPER", label: "Found a better price elsewhere" },
  { value: "DELIVERY_TOO_SLOW", label: "Delivery is taking too long" },
  { value: "CHANGED_MIND", label: "I changed my mind" },
  { value: "WRONG_ITEM_ORDERED", label: "Ordered the wrong item" },
  { value: "OTHER", label: "Other reason" },
];

// The reasons a *store* cancels, as opposed to the shopper-worded list above.
// A customer cancels because they changed their mind; the store cancels because
// it cannot fill the order. Same field, opposite side of the counter, so the two
// lists have nothing in common and sharing one would put "I changed my mind" in
// an admin dropdown.
//
// Whichever is picked is resolved to its label before it is stored, because
// Order.cancelReason is free text that the customer reads back verbatim on their
// orders page and in the cancellation email.
export const STORE_CANCEL_REASONS = [
  { value: "OUT_OF_STOCK", label: "Item is out of stock" },
  { value: "ADDRESS_UNSERVICEABLE", label: "We cannot deliver to this address" },
  { value: "CUSTOMER_REQUEST", label: "Customer asked us to cancel" },
  { value: "PAYMENT_ISSUE", label: "Payment could not be verified" },
  { value: "DUPLICATE_ORDER", label: "Duplicate order" },
  { value: "OTHER", label: "Other reason" },
];

export function cancelReasonLabel(value) {
  const known = [...CANCEL_REASONS, ...STORE_CANCEL_REASONS].find((r) => r.value === value);
  // Falls through to the raw value on purpose: reasons are stored resolved, so
  // anything that reaches here unrecognised is already a human-readable string
  // (a store note, or a row written before these lists existed).
  return known?.label ?? value;
}

/**
 * Can this order still be cancelled outright?
 *
 * Two gates, and the second is the one that closes in practice. The status gate
 * catches orders whose parcel has demonstrably gone; the time gate catches the
 * ordinary case, where the order still reads CONFIRMED because no screen in this
 * app advances it but the courier has long since collected it.
 *
 * The same verdict binds the shopper and the store. An admin who cancels a
 * dispatched order does not stop the parcel — it refunds the card and puts stock
 * back for goods that are on a van — so the window is enforced on both sides of
 * the counter. Past it, the way out of an order is the courier's desk, not this
 * button.
 *
 * @param {object} order
 * @param {object} [options]
 * @param {string|number} [options.windowHours] live `order_cancel_window_hours`
 *   setting; anything unusable falls back to DEFAULT_CANCEL_WINDOW_HOURS.
 * @param {Date|string|number} [options.now] evaluation instant, for tests.
 * @returns {{allowed: boolean, message: string, expired: boolean, deadline: Date|null}}
 *   `message` explains the "no"; `deadline` is set whenever the order carries a
 *   usable placement date, so the UI can show it while cancelling is still open.
 */
export function canCancelOrder(order, options = {}) {
  const { windowHours, now } = options;

  if (!order) {
    return { allowed: false, expired: false, deadline: null, message: "Order not found." };
  }
  if (order.status === "CANCELLED") {
    return {
      allowed: false,
      expired: false,
      deadline: null,
      message: "This order is already cancelled.",
    };
  }
  if (order.status === "DELIVERED") {
    return {
      allowed: false,
      expired: false,
      deadline: null,
      message: "This order has already been delivered.",
    };
  }
  if (!CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
    return {
      allowed: false,
      expired: false,
      deadline: null,
      message: "This order has already been shipped and can no longer be cancelled.",
    };
  }

  const deadline = cancelWindowEndsAt(order, windowHours);
  const at = now == null ? Date.now() : new Date(now).getTime();
  // Half-open, like the draw cycle: the deadline instant is the first instant
  // that is too late, so a window quoted as "24 hours" is exactly 24 hours long.
  if (deadline && at >= deadline.getTime()) {
    return {
      allowed: false,
      expired: true,
      deadline,
      message:
        `Orders can only be cancelled within ${formatCancelWindow(windowHours)} of being placed. ` +
        `The window for this order closed on ${formatCancelDeadline(deadline)}, and it is now with ` +
        `our delivery partner.`,
    };
  }

  return { allowed: true, expired: false, deadline, message: "" };
}
