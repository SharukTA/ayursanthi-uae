import Stripe from "stripe";

// Server-side Stripe client. Nothing in this file may ever be imported from a
// client component: STRIPE_SECRET_KEY has no NEXT_PUBLIC_ prefix precisely so
// that bundling it into the browser fails loudly rather than silently leaking.
//
// The store uses Stripe-hosted Checkout: the shopper is redirected to Stripe's
// own page, pays there, and comes back. No card data ever touches this app, and
// no Stripe JavaScript runs on ayurshoppee.ae — which is also why Apple Pay
// needs no domain-verification file. Which wallets appear (Apple Pay, Google
// Pay, Link) is decided by the payment method configuration in the Stripe
// dashboard, not by this code, so enabling one there is enough.

let client = null;

/**
 * Whether online payment is available at all. False on an install that has not
 * been given a Stripe key — the checkout UI hides the online option instead of
 * offering a button that can only fail.
 */
export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * The shared Stripe client, created on first use. Constructing it lazily keeps
 * a missing key from throwing at import time, which would take down every route
 * that merely mentions Stripe rather than just the ones that need it.
 */
export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured: STRIPE_SECRET_KEY is missing.");
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}

// Stripe quotes every amount in the currency's smallest unit. AED's is the fils,
// 1/100 of a dirham, so a 249.50 AED order is 24950. Rounding here rather than
// truncating matters: Decimal(10,2) values arriving as 12.34 can surface as
// 12.339999999999998 once they pass through Number().
export function toFils(amount) {
  return Math.round(Number(amount) * 100);
}

// Payouts land in AED (see the Wio account attached in the dashboard), so
// charging in anything else would add a conversion fee for no reason.
export const STRIPE_CURRENCY = "aed";

/**
 * Absolute origin for the URLs Stripe redirects back to. These are handed to
 * Stripe, not to the browser, so a relative path is not an option and a wrong
 * value strands the shopper somewhere else entirely after they have paid.
 *
 * NEXT_PUBLIC_SITE_URL is the live domain even on a developer's machine — order
 * emails have to link somewhere real — so using it unconditionally would send a
 * local test payment back to production. In development the request's own origin
 * wins instead.
 *
 * Only in development. In production the Host header is whatever the caller
 * says it is, and this value is a redirect target handed to Stripe, so it has to
 * come from configuration rather than from the request.
 *
 * @param {Request} [request] the incoming request, used only in development.
 */
export function getSiteOrigin(request) {
  if (process.env.NODE_ENV !== "production" && request) {
    try {
      return new URL(request.url).origin;
    } catch {
      // Fall through to the configured value.
    }
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return "http://localhost:3000";
}
