/**
 * Cancellation policy — the single source of truth for "can this order be
 * cancelled, and what happens to the money".
 *
 * Deliberately free of any Prisma import so the customer UI can run the exact
 * same eligibility checks the API enforces: the dashboard hides a button using
 * these helpers, and the route re-runs them before writing anything. The API is
 * always the authority; the UI copy just avoids dead-end clicks.
 *
 * The store does not accept returns or replacements. CANCEL is the only way out
 * of an order, and it closes the moment the parcel is handed to the courier.
 */

// Fulfillment states a customer may still cancel from. SHIPPED and
// OUT_FOR_DELIVERY are intentionally absent: the parcel is already with the
// courier, and one that is out on the van is even further gone.
export const CANCELLABLE_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING"];

// The fulfillment ladder, in order. An order only ever moves *forward* along it,
// and may drop to CANCELLED from any non-terminal rung. DELIVERED and CANCELLED
// are terminal: the admin dropdown offers nothing further and the API refuses
// it — so a CONFIRMED order can never be walked back to PENDING, and a CANCELLED
// one is frozen.
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

export const CANCEL_REASONS = [
  { value: "ORDERED_BY_MISTAKE", label: "Ordered by mistake" },
  { value: "FOUND_CHEAPER", label: "Found a better price elsewhere" },
  { value: "DELIVERY_TOO_SLOW", label: "Delivery is taking too long" },
  { value: "CHANGED_MIND", label: "I changed my mind" },
  { value: "WRONG_ITEM_ORDERED", label: "Ordered the wrong item" },
  { value: "OTHER", label: "Other reason" },
];

export function cancelReasonLabel(value) {
  return CANCEL_REASONS.find((r) => r.value === value)?.label ?? value;
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
    return { allowed: false, message: "This order has already been delivered." };
  }
  if (!CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
    return {
      allowed: false,
      message: "This order has already been shipped and can no longer be cancelled.",
    };
  }
  return { allowed: true, message: "" };
}
