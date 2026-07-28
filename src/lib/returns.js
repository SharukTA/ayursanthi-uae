/**
 * Cancellation & return policy — the single source of truth for "can this order
 * be cancelled / returned, and how much money goes back".
 *
 * Deliberately free of any Prisma import so the customer UI can run the exact
 * same eligibility checks the API enforces: the dashboard hides a button using
 * these helpers, and the route re-runs them before writing anything. The API is
 * always the authority; the UI copy just avoids dead-end clicks.
 *
 * The model follows Amazon:
 *   - CANCEL happens before the parcel is handed to the courier. Once it ships,
 *     cancelling is off the table — the customer waits for delivery and returns.
 *   - RETURN happens after delivery, inside a fixed window, per item and per
 *     unit, with a reason picked from a fixed list.
 */

// How long after delivery a customer may still start a return.
export const RETURN_WINDOW_DAYS = 7;

// Fulfillment states a customer may still cancel from. SHIPPED and
// OUT_FOR_DELIVERY are intentionally absent: the parcel is already with the
// courier, and one that is out on the van is even further gone.
export const CANCELLABLE_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING"];

// The fulfillment ladder, in order. An order only ever moves *forward* along it,
// and may drop to CANCELLED from any non-terminal rung. DELIVERED and CANCELLED
// are terminal: the admin dropdown offers nothing further and the API refuses
// it — so a CONFIRMED order can never be walked back to PENDING, and a CANCELLED
// one is frozen. Post-delivery changes are handled through returns, not here.
//
// Every rung lists *all* the rungs ahead of it, not just the next one: a small
// store often hands a parcel over and only updates the record once, so skipping
// straight from PROCESSING to DELIVERED has to stay legal.
export const ORDER_STATUS_TRANSITIONS = {
  PENDING: [
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
  ],
  CONFIRMED: ["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
  PROCESSING: ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

/**
 * May an order move from `from` to `to`? Re-saving the same status is treated as
 * a harmless no-op; every other move must be a forward step on the ladder above.
 */
export function canTransitionOrderStatus(from, to) {
  if (from === to) return true;
  return (ORDER_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

// Return statuses that still hold on to the units they cover. A REJECTED or
// CANCELLED request releases them, so the customer can ask again.
export const ACTIVE_RETURN_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "PICKED_UP",
  "RECEIVED",
  "REFUNDED",
  "REPLACED",
];

// Nothing moves once a request reaches one of these.
export const TERMINAL_RETURN_STATUSES = ["REFUNDED", "REPLACED", "REJECTED", "CANCELLED"];

// A customer may withdraw their own request only while the item is still with
// them — after pickup it is in transit and the seller owns the outcome.
export const CUSTOMER_WITHDRAWABLE_RETURN_STATUSES = ["REQUESTED", "APPROVED"];

// Reasons that mean the unit cannot go back on the shelf, so RECEIVED skips the
// restock step for them.
export const NON_RESTOCKABLE_REASONS = ["DAMAGED", "DEFECTIVE"];

export const CANCEL_REASONS = [
  { value: "ORDERED_BY_MISTAKE", label: "Ordered by mistake" },
  { value: "FOUND_CHEAPER", label: "Found a better price elsewhere" },
  { value: "DELIVERY_TOO_SLOW", label: "Delivery is taking too long" },
  { value: "CHANGED_MIND", label: "I changed my mind" },
  { value: "WRONG_ITEM_ORDERED", label: "Ordered the wrong item" },
  { value: "OTHER", label: "Other reason" },
];

export const RETURN_REASONS = [
  { value: "DAMAGED", label: "Item arrived damaged" },
  { value: "DEFECTIVE", label: "Item is defective or does not work" },
  { value: "WRONG_ITEM", label: "Wrong item was sent" },
  { value: "MISSING_PARTS", label: "Parts or accessories are missing" },
  { value: "NOT_AS_DESCRIBED", label: "Item does not match the description" },
  { value: "NO_LONGER_NEEDED", label: "No longer needed" },
  { value: "BOUGHT_BY_MISTAKE", label: "Bought by mistake" },
  { value: "BETTER_PRICE", label: "Found a better price elsewhere" },
  { value: "OTHER", label: "Other reason" },
];

export const RETURN_RESOLUTIONS = [
  { value: "REFUND", label: "Refund", hint: "Money is sent back once we receive the item." },
  {
    value: "REPLACEMENT",
    label: "Replacement",
    hint: "We ship the same item again at no extra cost.",
  },
];

export const REFUND_METHODS = [
  {
    value: "BANK_TRANSFER",
    label: "Bank transfer",
    hint: "We transfer the amount to your account in 3-5 business days.",
  },
  {
    value: "CASH_ON_PICKUP",
    label: "Cash on pickup",
    hint: "The courier hands you the cash when collecting the item.",
  },
];

// Customer-facing wording for each return state, mirroring the one-liners Amazon
// shows on "Your Returns".
export const RETURN_STATUS_COPY = {
  REQUESTED: { label: "Return requested", hint: "We are reviewing your request." },
  APPROVED: { label: "Return approved", hint: "Keep the item packed — pickup is scheduled." },
  PICKED_UP: { label: "Picked up", hint: "The item is on its way back to us." },
  RECEIVED: { label: "Item received", hint: "We have the item and are processing your refund." },
  REFUNDED: { label: "Refund issued", hint: "The money is on its way to you." },
  REPLACED: { label: "Replacement sent", hint: "A fresh unit has been dispatched." },
  REJECTED: { label: "Return declined", hint: "This request was not approved." },
  CANCELLED: { label: "Return cancelled", hint: "You withdrew this request." },
};

// Which statuses an admin may move a request to next. REFUNDED/REPLACED are
// reachable only from RECEIVED — money never leaves before the item is back.
//
// REJECTED (Decline) is offered ONLY at REQUESTED: declining is the decision you
// make *instead* of accepting. Once a return is APPROVED the seller has
// committed to it, so Decline disappears from every later stage — both in the
// admin UI (which reads this map) and in the API (which enforces it).
export const RETURN_STATUS_TRANSITIONS = {
  REQUESTED: ["APPROVED", "REJECTED"],
  APPROVED: ["PICKED_UP"],
  PICKED_UP: ["RECEIVED"],
  RECEIVED: ["REFUNDED", "REPLACED"],
  REFUNDED: [],
  REPLACED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function returnReasonLabel(value) {
  return RETURN_REASONS.find((r) => r.value === value)?.label ?? value;
}

export function cancelReasonLabel(value) {
  return CANCEL_REASONS.find((r) => r.value === value)?.label ?? value;
}

export function isTerminalReturnStatus(status) {
  return TERMINAL_RETURN_STATUSES.includes(status);
}

/**
 * Can the customer still cancel this order outright?
 * @returns {{allowed: boolean, message: string}} message explains the "no".
 */
export function canCancelOrder(order) {
  if (!order) {
    return { allowed: false, message: "Order not found." };
  }
  if (order.status === "CANCELLED") {
    return { allowed: false, message: "This order is already cancelled." };
  }
  if (order.status === "DELIVERED") {
    return {
      allowed: false,
      message: "This order has been delivered. You can return items instead.",
    };
  }
  if (!CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
    return {
      allowed: false,
      message:
        "This order has already been shipped and can no longer be cancelled. You can return it once it arrives.",
    };
  }
  return { allowed: true, message: "" };
}

/** Last moment a return may be started, or null when the order isn't delivered. */
export function returnWindowEndsAt(order) {
  if (!order || order.status !== "DELIVERED") return null;
  // deliveredAt is stamped when an admin marks the order DELIVERED; updatedAt is
  // the fallback for rows created before that column existed.
  const deliveredAt = order.deliveredAt ?? order.updatedAt;
  if (!deliveredAt) return null;

  const ends = new Date(deliveredAt);
  ends.setDate(ends.getDate() + RETURN_WINDOW_DAYS);
  return ends;
}

/**
 * Can the customer open a return on this order at all? Per-item availability is
 * a separate question — see returnableUnits().
 */
export function canReturnOrder(order, now = new Date()) {
  if (!order) {
    return { allowed: false, message: "Order not found." };
  }
  if (order.status !== "DELIVERED") {
    return {
      allowed: false,
      message: "You can request a return once the order has been delivered.",
    };
  }

  const endsAt = returnWindowEndsAt(order);
  if (endsAt && now > endsAt) {
    return {
      allowed: false,
      message: `The ${RETURN_WINDOW_DAYS}-day return window for this order closed on ${endsAt.toLocaleDateString()}.`,
    };
  }

  const units = returnableUnits(order);
  const anyLeft = Object.values(units).some((qty) => qty > 0);
  if (!anyLeft) {
    return {
      allowed: false,
      message: "Every item in this order is already part of a return.",
    };
  }

  return { allowed: true, message: "" };
}

/**
 * How many units of each order line are still returnable, i.e. ordered quantity
 * minus whatever an active return request already covers.
 *
 * @param {{items: Array, returns?: Array}} order  order with items + returns loaded
 * @returns {Record<string, number>} orderItemId -> units still returnable
 */
export function returnableUnits(order) {
  const remaining = {};
  for (const item of order?.items ?? []) {
    remaining[item.id] = Number(item.quantity);
  }

  for (const request of order?.returns ?? []) {
    if (!ACTIVE_RETURN_STATUSES.includes(request.status)) continue;
    for (const line of request.items ?? []) {
      if (remaining[line.orderItemId] === undefined) continue;
      remaining[line.orderItemId] -= Number(line.quantity);
    }
  }

  for (const key of Object.keys(remaining)) {
    remaining[key] = Math.max(0, remaining[key]);
  }
  return remaining;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Refund maths for a set of selected units, the way Amazon splits it:
 *   - the item value goes back in full,
 *   - shipping only when nothing sellable stays with the customer, because the
 *     delivery still happened for anything they keep.
 *
 * No tax component: the store charges none (see lib/pricing.js), so a refund is
 * item value + shipping.
 *
 * @param {object} order                       order with items (+ returns) loaded
 * @param {Array<{orderItemId: string, quantity: number}>} selections
 * @returns {{items: number, shipping: number, total: number}}
 */
export function computeRefundBreakdown(order, selections) {
  const byId = new Map((order?.items ?? []).map((item) => [item.id, item]));

  let itemsAmount = 0;
  for (const selection of selections ?? []) {
    const item = byId.get(selection.orderItemId);
    if (!item) continue;
    itemsAmount += Number(item.price) * Number(selection.quantity);
  }
  itemsAmount = round2(itemsAmount);

  // Units already gone (earlier returns) plus the ones being sent back now: if
  // that covers the whole order, the shipping fee goes back too.
  const remainingAfter = returnableUnits(order);
  for (const selection of selections ?? []) {
    if (remainingAfter[selection.orderItemId] === undefined) continue;
    remainingAfter[selection.orderItemId] -= Number(selection.quantity);
  }
  const wholeOrderGone = Object.values(remainingAfter).every((qty) => qty <= 0);
  const shipping = wholeOrderGone ? round2(Number(order?.shipping ?? 0)) : 0;

  return { items: itemsAmount, shipping, total: round2(itemsAmount + shipping) };
}
