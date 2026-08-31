"use client";

import { useEffect } from "react";
import { clearBuyNowItem, finalizePurchase, notifyCartChanged } from "@/lib/cart-client";

/**
 * Tidies the browser-side baskets after a payment that happened on Stripe's
 * domain.
 *
 * Payment leaves the site, so the shopper comes back on a brand new page load:
 * the localStorage cart and any Buy Now item are still sitting there holding
 * products that have now been bought and paid for. Clearing them server-side is
 * not an option — they only exist in this browser.
 *
 * Which basket to touch is not obvious once the redirect has thrown away the
 * checkout page's state, so it travels with the order (recorded on the payment
 * row in lib/checkout.js). It matters: a shopper who used Buy Now on a product
 * that is *also* sitting in their cart bought the one-off copy, not the cart
 * line, and silently emptying the cart line would take away something they never
 * bought and never saw on the checkout screen.
 *
 * Renders nothing; it is an effect with a component wrapped round it.
 */
export function PaymentSuccessCleanup({ productIds, cartSource }) {
  useEffect(() => {
    if (cartSource === "buynow") {
      // Belongs to no cart at all — just discard the one-off item.
      clearBuyNowItem();
      notifyCartChanged();
    } else if (cartSource === "guest") {
      // Bought out of this browser's cart: drop those lines from it. Whatever is
      // left merges into the account on the refresh below.
      finalizePurchase(productIds);
    } else {
      // Bought out of the saved account cart, whose lines the payment
      // confirmation has already removed server-side (lib/order-payment.js).
      // Anything left unticked was kept on purpose.
      notifyCartChanged();
    }

    // The header's cart badge and account menu both refresh on this. A shopper
    // who created their account during checkout is signed in but was redirected
    // away before the header ever heard about it.
    window.dispatchEvent(new Event("authUpdate"));
  }, [productIds, cartSource]);

  return null;
}
