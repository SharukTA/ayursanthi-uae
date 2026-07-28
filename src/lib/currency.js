/**
 * Currency — the single source of truth for how money is written anywhere in the
 * app: storefront, admin, transactional email, and the PDF invoice.
 *
 * The store is single-currency by design. Prices are entered by the admin in
 * AED and stored as plain Decimals with no currency column, because a per-product
 * currency cannot be summed: `calculateOrderTotals` (lib/pricing.js), the
 * free-shipping threshold, and refund amounts all assume every amount in an
 * order is in the same unit. If a display-only conversion is ever wanted (the
 * way Amazon offers an approximate price for foreign cards), it belongs on top
 * of this AED base, not in the product record.
 *
 * We write the ISO code as text — "AED 249.00" — rather than a glyph:
 *
 *   • U+20C3 (the 2025 dirham sign) only reaches system fonts with Unicode 18.0
 *     in September 2026, and takes years to reach real devices after that. Today
 *     it renders as a tofu box for most visitors.
 *   • Gmail and Outlook do not load webfonts, so a glyph can never be made safe
 *     in email — and order mail is the surface that matters most.
 *   • The Arabic د.إ is right-to-left and reorders unpredictably inside an
 *     otherwise left-to-right price.
 *
 * Switching to a glyph later is a change to formatMoney() alone, provided call
 * sites keep going through it.
 */

// Overridable so a staging/regional deployment can be pointed elsewhere without
// a code change. EMAIL_CURRENCY is the historical name for the same value and is
// still honoured; NEXT_PUBLIC_ is required for the value to reach the browser.
export const CURRENCY =
  process.env.NEXT_PUBLIC_CURRENCY || process.env.EMAIL_CURRENCY || "AED";

// UAE English formatting: western thousands grouping (1,248.00), not the Indian
// lakh grouping (1,23,456) the previous en-IN locale produced.
export const CURRENCY_LOCALE = "en-AE";

/**
 * A money amount as customer-facing text, e.g. `AED 1,248.00`.
 *
 * @param {number|string|import("@prisma/client").Prisma.Decimal|null} value
 * @param {{decimals?: number}} [options] decimals defaults to 2 — UAE retail
 *   always shows fils, even on round numbers. Pass 0 for rounded summary figures
 *   (dashboard totals, marketing copy) where cents are noise.
 * @returns {string}
 */
export function formatMoney(value, { decimals = 2 } = {}) {
  const amount = Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${CURRENCY} ${safe.toLocaleString(CURRENCY_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * The number alone, grouped but with no currency code — for the rare spot that
 * renders the code separately (a styled price block where "AED" is its own
 * element, or a range like "AED 50 – 200" with one code across both ends).
 */
export function formatAmount(value, { decimals = 2 } = {}) {
  const amount = Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  return safe.toLocaleString(CURRENCY_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
