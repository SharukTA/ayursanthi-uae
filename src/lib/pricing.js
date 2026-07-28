/**
 * Order pricing — the single source of truth for how an order total is
 * computed, shared by the cart, the checkout page, and the server that actually
 * writes the order (lib/checkout.js). The client screens use this only to show
 * an accurate preview; the server recomputes everything from DB values before
 * saving, so a tampered browser can never change what is charged.
 *
 * The model:
 *
 *   • Prices are tax-inclusive and final. The amount on the card is the amount
 *     charged for the goods — nothing is calculated, added, or broken out on
 *     top of it anywhere in the app, the invoice or the emails. There is no tax
 *     rate stored per product, per order line, or site-wide.
 *
 *   • Delivery is a per-product fee (seller-fulfilled shipping), summed across
 *     the order and waived entirely once the subtotal clears the free-shipping
 *     threshold.
 *
 *   • Order total = subtotal (goods) + delivery.
 *
 * Every screen that prints a price says so in words, using TAX_INCLUSIVE_LABEL
 * below, so a shopper never has to wonder whether tax gets added at checkout.
 */

/**
 * The one line every price surface prints beneath an amount: product cards, the
 * product page buy box, the cart summary and the checkout summary all import
 * this rather than typing their own, so the wording can never drift apart
 * between screens.
 */
export const TAX_INCLUSIVE_LABEL = "Inclusive of all taxes";

// Default order value (goods subtotal) at or above which delivery is free,
// whatever the per-product shipping fees add up to. Denominated in the store
// currency (AED — see lib/currency.js). This is only the fallback: the live
// threshold is an admin-editable site setting (`free_shipping_threshold` in
// lib/settings.js), read on the server and passed into calculateOrderTotals.
export const FREE_SHIPPING_THRESHOLD = 150;

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Totals for a set of line items.
 *
 * @param {Array<{price:number, quantity:number, shippingFee?:number}>} items
 * @param {number} [freeShippingThreshold] subtotal at/above which delivery is
 *   free; defaults to FREE_SHIPPING_THRESHOLD when the caller has no live value.
 * @returns {{subtotal:number, shipping:number, total:number}}
 *   subtotal — goods total (what the customer pays for items)
 *   shipping — summed per-product delivery, 0 above the free-shipping threshold
 *   total    — subtotal + shipping
 */
export function calculateOrderTotals(items, freeShippingThreshold = FREE_SHIPPING_THRESHOLD) {
  const threshold = Number.isFinite(Number(freeShippingThreshold))
    ? Number(freeShippingThreshold)
    : FREE_SHIPPING_THRESHOLD;

  let subtotal = 0;
  let shippingRaw = 0;

  for (const item of items ?? []) {
    const quantity = Number(item.quantity) || 0;
    if (quantity <= 0) continue;

    subtotal = round2(subtotal + round2(Number(item.price) * quantity));
    // The delivery fee is per product line (a listing's shipping charge), not
    // multiplied by quantity.
    shippingRaw = round2(shippingRaw + (Number(item.shippingFee) || 0));
  }

  const shipping = subtotal === 0 || subtotal >= threshold ? 0 : shippingRaw;
  const total = round2(subtotal + shipping);

  return { subtotal, shipping, total };
}
