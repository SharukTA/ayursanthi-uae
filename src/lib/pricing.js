/**
 * Order pricing — the single source of truth for how GST and delivery are
 * computed, shared by the cart, the checkout page, and the server that actually
 * writes the order (lib/checkout.js). The client screens use this only to show
 * an accurate preview; the server recomputes everything from DB values before
 * saving, so a tampered browser can never change what is charged.
 *
 * The model follows Amazon India:
 *
 *   • Prices are GST-INCLUSIVE. The price the shopper sees is the price they pay
 *     for the goods — GST is never added on top. Each product carries a GST slab
 *     (0/5/12/18/28%); that rate only splits out the tax already sitting inside
 *     the price, for the invoice.
 *
 *   • Delivery is a per-product fee (seller-fulfilled shipping), summed across
 *     the order and waived entirely once the subtotal clears the free-shipping
 *     threshold.
 *
 *   • Order total = subtotal (goods, incl. GST) + delivery. Tax is NOT added
 *     again — it is already inside the subtotal.
 */

// Default order value (goods subtotal) at or above which delivery is free,
// whatever the per-product shipping fees add up to. This is only the fallback:
// the live threshold is an admin-editable site setting (`free_shipping_threshold`
// in lib/settings.js), read on the server and passed into calculateOrderTotals.
export const FREE_SHIPPING_THRESHOLD = 1000;

// The GST slabs an admin may assign to a product — the standard Indian GST
// rates. Kept here so the admin form, the API validation, and the maths agree.
export const GST_RATES = [0, 5, 12, 18, 28];

// A product with no slab chosen is treated as 0% (unclassified / exempt).
export const DEFAULT_GST_RATE = 0;

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

// Coerce a raw GST-rate input to one of the allowed slabs, else the default.
export function normalizeGstRate(value) {
  const rate = Number(value);
  return GST_RATES.includes(rate) ? rate : DEFAULT_GST_RATE;
}

/**
 * The GST already embedded inside a tax-INCLUSIVE amount at `rate` percent.
 *   inclusive = base + base * rate/100   =>   tax = inclusive * rate / (100 + rate)
 */
export function gstFromInclusive(amountInclusive, rate) {
  const r = Number(rate) || 0;
  if (r <= 0) return 0;
  return round2((Number(amountInclusive) * r) / (100 + r));
}

/**
 * True when a stored order charged GST on TOP of its subtotal (the pre-Amazon
 * model: total = subtotal + tax + shipping) rather than baking it into the
 * inclusive prices (total = subtotal + shipping). Lets the order/refund views
 * render historical orders correctly alongside new ones.
 */
export function orderChargesTaxOnTop(order) {
  const subtotal = Number(order?.subtotal ?? 0);
  const shipping = Number(order?.shipping ?? 0);
  const total = Number(order?.total ?? 0);
  return total > round2(subtotal + shipping) + 0.01;
}

/**
 * Totals for a set of line items under the tax-inclusive model above.
 *
 * @param {Array<{price:number, quantity:number, gstRate?:number, shippingFee?:number}>} items
 * @param {number} [freeShippingThreshold] subtotal at/above which delivery is
 *   free; defaults to FREE_SHIPPING_THRESHOLD when the caller has no live value.
 * @returns {{subtotal:number, tax:number, shipping:number, total:number}}
 *   subtotal — goods total, GST included (what the customer pays for items)
 *   tax      — the GST portion already inside `subtotal` (informational)
 *   shipping — summed per-product delivery, 0 above the free-shipping threshold
 *   total    — subtotal + shipping
 */
export function calculateOrderTotals(items, freeShippingThreshold = FREE_SHIPPING_THRESHOLD) {
  const threshold = Number.isFinite(Number(freeShippingThreshold))
    ? Number(freeShippingThreshold)
    : FREE_SHIPPING_THRESHOLD;

  let subtotal = 0;
  let tax = 0;
  let shippingRaw = 0;

  for (const item of items ?? []) {
    const quantity = Number(item.quantity) || 0;
    if (quantity <= 0) continue;

    const lineTotal = round2(Number(item.price) * quantity);
    subtotal = round2(subtotal + lineTotal);
    tax = round2(tax + gstFromInclusive(lineTotal, item.gstRate));
    // The delivery fee is per product line (a listing's shipping charge), not
    // multiplied by quantity.
    shippingRaw = round2(shippingRaw + (Number(item.shippingFee) || 0));
  }

  const shipping = subtotal === 0 || subtotal >= threshold ? 0 : shippingRaw;
  const total = round2(subtotal + shipping);

  return { subtotal, tax, shipping, total };
}
