"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Banknote,
  Lock,
  CheckCircle,
  ChevronRight,
  Loader2,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CheckoutBanner } from "@/components/CheckoutBanner";
import { PhoneField } from "@/components/PhoneField";
import { CountrySelect, StateField } from "@/components/AddressFields";
import { validatePhone } from "@/lib/validation";
import { getCountry } from "@/lib/geo/countries";
import {
  countryUsesPostalCode,
  postalCodeLabel,
  subdivisionLabel,
} from "@/lib/geo/postal";
import {
  calculateOrderTotals,
  FREE_SHIPPING_THRESHOLD,
  TAX_INCLUSIVE_LABEL,
} from "@/lib/pricing";
import { formatMoney } from "@/lib/currency";
import {
  clearBuyNowItem,
  finalizePurchase,
  getCart,
  notifyCartChanged,
  readBuyNowItem,
} from "@/lib/cart-client";

// ─────────────────────────────────────────────────────────────────────────────
// Amazon-style checkout ("secure checkout pipeline"): a white page with three
// numbered steps stacked down the left — 1 Shipping address, 2 Payment method,
// 3 Review items and delivery — and a sticky "Place your order" panel pinned to
// the right, repeated in a full-width box at the bottom of the steps.
//
// Palette follows the Amazon tokens in globals.css: ink #0f1111, muted #565959,
// hairline #d5d9d9 / #e7e7e7, link teal #007185 (hover #c7511f), CTA yellow
// #ffd814, and price red #b12704 which is reserved for order totals.
//
// Nothing here is CMS-editable except <CheckoutBanner /> at the very bottom.
// ─────────────────────────────────────────────────────────────────────────────

// Amazon's form field: a 3px-radius box with a darker border, an inset top
// shadow, and the orange focus glow.
const FIELD =
  "w-full min-w-0 h-9 rounded-[3px] border border-[#888c8c] bg-white px-3 text-[13px] text-[#0f1111] outline-none shadow-[inset_0_1px_2px_rgba(15,17,17,0.15)] transition focus:border-[#e77600] focus:shadow-[0_0_3px_2px_rgba(228,121,17,0.5)] disabled:bg-[#f7fafa] disabled:text-[#565959]";

const FIELD_LABEL = "grid gap-1 min-w-0 text-[13px] font-bold text-[#0f1111]";

// The yellow primary CTA. A bare <button> on purpose — the shared <Button>
// variants are themed for dark surfaces, and the global CTA rules in globals.css
// only rewrite emerald/white buttons, so this keeps full control of the look.
const YELLOW_CTA =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#fcd200] bg-[#ffd814] px-4 text-[13px] font-bold text-[#0f1111] shadow-[0_2px_5px_rgba(15,17,17,0.15)] transition hover:bg-[#f7ca00] disabled:cursor-not-allowed disabled:opacity-60";

// The site already presents delivery as a plain client-side estimate (see
// DeliveryEstimator) — the review step reuses the same 3–6 day window so both
// screens promise the shopper the same thing.
function estimatedDeliveryWindow() {
  const start = new Date();
  start.setDate(start.getDate() + 3);
  const end = new Date();
  end.setDate(end.getDate() + 6);
  const fmt = (d) =>
    d.toLocaleDateString("en-AE", { weekday: "short", day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

// Alias kept so the JSX below reads the same; the formatting itself is shared
// with the cart, the invoice and the order emails via lib/currency.js.
const money = formatMoney;

// Shared shell for the interstitial screens (auth gate, admin block, success),
// so they sit on the same white Amazon page as the checkout itself.
function CheckoutShell({ children }) {
  return (
    <main className="flex min-h-screen flex-col bg-white text-[#0f1111]">
      <SiteHeader />
      <div className="flex flex-1 items-center justify-center p-4">{children}</div>
      <SiteFooter />
    </main>
  );
}

// Numbered step heading — "1 Shipping address".
function StepHeading({ step, title, children }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <h2 className="text-[18px] font-bold leading-6 text-[#0f1111]">
        <span className="mr-1.5">{step}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function CheckoutPage() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [cart, setCart] = useState([]);
  const [cartLoaded, setCartLoaded] = useState(false);

  // "Buy Now" from a product page checks out a single item independently of the
  // shopping cart. When set, this checkout totals only the buy-now item and
  // leaves the cart (and its total) completely untouched.
  const [buyNowMode, setBuyNowMode] = useState(false);

  // Address Fields. `country` is an ISO2 code, defaulting to the UAE — the
  // store's home market, so the overwhelming majority of shoppers never touch
  // the selector. The snapshot sent to the server carries the readable country
  // name plus the code.
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("AE");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // The UAE and several other markets have no postal codes, so the field is
  // optional there. The order API applies the same rule server-side.
  const needsPostalCode = countryUsesPostalCode(country);

  // Cash on Delivery is currently the only way to pay — no online gateway.
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [placedOrderDetails, setPlacedOrderDetails] = useState(null);

  // Sentinel placed in normal flow at the bottom of the checkout content. While
  // it is off-screen (the customer hasn't scrolled down to the inline "Place
  // your order" box yet) we surface a fixed bar so they can confirm from
  // anywhere — Amazon's mobile checkout footer.
  const placeOrderRef = useRef(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  // Live free-shipping threshold (admin-editable); the constant is the fallback
  // until the settings fetch resolves. The server enforces the authoritative one.
  const [freeShipThreshold, setFreeShipThreshold] = useState(FREE_SHIPPING_THRESHOLD);

  // 1. Fetch Session & Cart
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (data.loggedIn) {
          setSession(data.session);
          setFullName(data.session.name || "");
        }
      } catch (e) {
        console.error("Auth check failed.");
      } finally {
        setAuthChecked(true);
      }
    }

    checkAuth();

    // ?buynow=1 means we arrived here straight from a product page's "Buy Now"
    // and should check out only that single stashed item — not the cart.
    const isBuyNow = new URLSearchParams(window.location.search).get("buynow") === "1";
    setBuyNowMode(isBuyNow);

    async function loadBasket() {
      try {
        if (isBuyNow) {
          const item = readBuyNowItem();
          setCart(item ? [item] : []);
          return;
        }
        // Checkout is gated on being signed in, so in practice this is always
        // the account cart — read live from the database, with any cart built
        // while signed out already merged in (see lib/cart-client.js).
        const { items } = await getCart();
        setCart(items);
      } catch {
        console.error("Failed to load cart.");
      } finally {
        // Marks the read as done so the empty state only shows once we actually
        // know the basket is empty, rather than flashing during the first paint.
        setCartLoaded(true);
      }
    }

    loadBasket();
  }, []);

  // Pull the current free-shipping threshold so the totals here match the cart
  // and the server. Falls back to the constant until it resolves.
  useEffect(() => {
    let active = true;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const n = Number(data?.settings?.free_shipping_threshold);
        if (active && Number.isFinite(n) && n >= 0) setFreeShipThreshold(n);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Only items the customer ticked in the cart are part of this booking. Items
  // without the flag are treated as selected (carts saved before checkboxes).
  // In buy-now mode `cart` already holds just the single item being purchased.
  const bookingItems = cart.filter((item) => item.selected !== false);

  // Watch the bottom sentinel: reveal the fixed bar while it's off-screen.
  useEffect(() => {
    const el = placeOrderRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [authChecked, session, orderSuccess, bookingItems.length]);

  const itemCount = bookingItems.reduce((acc, item) => acc + item.quantity, 0);
  // The order total is goods + delivery (see lib/pricing.js) — prices are
  // tax-inclusive, so nothing is added on top of them here or on the server.
  // The server recomputes all of this from DB prices before the order is created.
  const { subtotal, shipping, total } = calculateOrderTotals(
    bookingItems,
    freeShipThreshold
  );
  const deliveryWindow = estimatedDeliveryWindow();

  const buildShippingAddress = () => ({
    fullName: fullName.trim(),
    phone: phone.trim(),
    line1: line1.trim(),
    line2: line2.trim() || undefined,
    city: city.trim(),
    state: state.trim(),
    postalCode: postalCode.trim(),
    country: getCountry(country)?.name || "",
    countryCode: country,
  });

  const onOrderSuccess = (data) => {
    toast.success("Order Placed Successfully!");
    if (buyNowMode) {
      // Buy-now never touched the cart — just discard the one-off item.
      clearBuyNowItem();
      notifyCartChanged();
    } else {
      // The account cart already had the purchased lines removed inside the
      // order transaction (lib/checkout.js), and anything left unticked was
      // deliberately kept. This only prunes a browser copy.
      finalizePurchase(bookingItems.map((item) => item.productId));
    }
    setPlacedOrderDetails({
      orderNumber: data.orderNumber,
      totalAmount: total,
      address: [line1, city, state].filter(Boolean).join(", ") + (postalCode ? ` - ${postalCode}` : ""),
      delivery: deliveryWindow,
    });
    setOrderSuccess(true);
  };

  // Cash on Delivery: a single call creates the order. Nothing is charged now —
  // the customer pays the courier on delivery.
  const submitCodOrder = async () => {
    setSubmitting(true);
    const toastId = toast.loading("Placing your order...");

    try {
      const cartPayload = bookingItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cart: cartPayload,
          shippingAddress: buildShippingAddress(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not place your order.");

      toast.dismiss(toastId);
      onOrderSuccess(data);
    } catch (error) {
      toast.error(error.message || "Something went wrong placing your order.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    if (!session) {
      toast.error("Please login to complete checkout.");
      return;
    }

    if (bookingItems.length === 0) {
      toast.error("Please select at least one product to check out.");
      return;
    }

    if (!country) {
      toast.error("Please select your country.");
      return;
    }

    if (
      !fullName.trim() ||
      !phone.trim() ||
      !line1.trim() ||
      !city.trim() ||
      !state.trim() ||
      (needsPostalCode && !postalCode.trim())
    ) {
      toast.error("Please complete all shipping address fields.");
      return;
    }

    // The phone is required here so the courier has a usable contact number for
    // the delivery and the cash collection.
    const phoneError = validatePhone(phone, { required: true });
    if (phoneError) {
      toast.error(phoneError);
      return;
    }

    // Cash on Delivery is the only payment option right now.
    await submitCodOrder();
  };

  if (!authChecked) {
    return (
      <CheckoutShell>
        <p className="text-sm font-semibold text-[#565959]">
          Checking your authorization status...
        </p>
      </CheckoutShell>
    );
  }

  // Not Logged In screen
  if (!session) {
    return (
      <CheckoutShell>
        <div className="w-full max-w-md rounded-lg border border-[#d5d9d9] bg-white p-6 text-center shadow-sm">
          <Lock className="mx-auto size-10 text-[#565959]" />
          <h2 className="mt-4 text-xl font-bold text-[#0f1111]">Secure Checkout Required</h2>
          <p className="mt-2 text-[13px] text-[#565959]">
            You must be logged in as a registered customer to complete your order booking.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link href="/login" className={`${YELLOW_CTA} h-9`}>
              Log In Account
              <ChevronRight className="size-4" />
            </Link>
            <Link
              href="/register"
              className="text-[13px] font-semibold text-[#007185] transition hover:text-[#c7511f] hover:underline"
            >
              Create new account instead
            </Link>
          </div>
        </div>
      </CheckoutShell>
    );
  }

  // Admins manage the catalog and cannot book products.
  if (session.role === "ADMIN") {
    return (
      <CheckoutShell>
        <div className="w-full max-w-md rounded-lg border border-[#d5d9d9] bg-white p-6 text-center shadow-sm">
          <Lock className="mx-auto size-10 text-[#ffa41c]" />
          <h2 className="mt-4 text-xl font-bold text-[#0f1111]">
            Booking Not Available for Admins
          </h2>
          <p className="mt-2 text-[13px] text-[#565959]">
            You are signed in as an administrator. Product booking is reserved for customer
            accounts. You can manage products and categories from the admin panel.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link href="/admin" className={`${YELLOW_CTA} h-9`}>
              Go to Admin Panel
              <ChevronRight className="size-4" />
            </Link>
            <Link
              href="/products"
              className="text-[13px] font-semibold text-[#007185] transition hover:text-[#c7511f] hover:underline"
            >
              Browse products instead
            </Link>
          </div>
        </div>
      </CheckoutShell>
    );
  }

  // Successful Checkout — Amazon's "Order placed, thanks!" confirmation.
  if (orderSuccess && placedOrderDetails) {
    return (
      <CheckoutShell>
        <div className="w-full max-w-2xl">
          <div className="flex items-start gap-3 border-b border-[#e7e7e7] pb-5">
            <CheckCircle className="mt-0.5 size-8 shrink-0 text-[#067d62]" />
            <div>
              <h2 className="text-2xl font-bold text-[#067d62]">Order placed, thank you!</h2>
              <p className="mt-1 text-[13px] text-[#565959]">
                Keep the cash ready — you pay the delivery agent when your order arrives. A
                confirmation has been added to your orders.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-[#d5d9d9] bg-white">
            <div className="border-b border-[#e7e7e7] bg-[#f0f2f2] px-4 py-2.5 text-[13px] font-bold text-[#0f1111]">
              Order details
            </div>
            <dl className="divide-y divide-[#e7e7e7] px-4 text-[13px]">
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-[#565959]">Order number</dt>
                <dd className="font-bold text-[#007185]">{placedOrderDetails.orderNumber}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-[#565959]">Amount payable on delivery</dt>
                <dd className="text-base font-bold text-[#b12704]">
                  {money(placedOrderDetails.totalAmount)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="shrink-0 text-[#565959]">Estimated delivery</dt>
                <dd className="text-right font-bold text-[#0f1111]">
                  {placedOrderDetails.delivery}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="shrink-0 text-[#565959]">Shipping to</dt>
                <dd className="text-right leading-5 text-[#0f1111]">
                  {placedOrderDetails.address}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/products" className={`${YELLOW_CTA} h-9 sm:w-auto sm:px-8`}>
              Continue shopping
            </Link>
            <Link
              href="/dashboard/orders"
              className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-[#d5d9d9] bg-white px-4 text-[13px] font-semibold text-[#0f1111] shadow-[0_2px_5px_rgba(15,17,17,0.1)] transition hover:bg-[#f7fafa] sm:w-auto sm:px-8"
            >
              View your orders
            </Link>
          </div>
        </div>
      </CheckoutShell>
    );
  }

  // ── The order summary panel. Rendered twice: sticky in the right column and
  // again in the box at the bottom of the steps, exactly like Amazon. ──
  const orderSummary = (
    <>
    <dl className="space-y-1.5 text-[13px] text-[#0f1111]">
      <div className="flex justify-between gap-4">
        <dt>
          Items ({itemCount}
          {itemCount === 1 ? " item" : " items"}):
        </dt>
        <dd>{money(subtotal)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Delivery:</dt>
        <dd>{shipping === 0 ? "FREE" : money(shipping)}</dd>
      </div>
      <div className="flex justify-between gap-4 border-t border-[#e7e7e7] pt-2 text-[18px] font-bold text-[#b12704]">
        <dt>Order total:</dt>
        <dd>{money(total)}</dd>
      </div>
    </dl>
    {/* The total above is the whole amount due — nothing is added after this
        screen. Sits outside the <dl>, which may only hold dt/dd pairs. */}
    <p className="mt-1 text-[11px] font-medium text-[#565959]">
      {TAX_INCLUSIVE_LABEL}
    </p>
    </>
  );

  const placeOrderButton = (
    <button type="submit" disabled={submitting} className={`${YELLOW_CTA} h-9`}>
      {submitting ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Placing your order...
        </>
      ) : (
        "Place your order"
      )}
    </button>
  );

  const termsNote = (
    <p className="text-[11px] leading-4 text-[#565959]">
      By placing your order, you agree to Ayursanthi&apos;s{" "}
      <Link href="/terms" className="text-[#007185] transition hover:text-[#c7511f] hover:underline">
        conditions of use and sale
      </Link>
      .
    </p>
  );

  return (
    <main className="flex min-h-screen flex-col bg-white text-[#0f1111]">
      <SiteHeader />

      {/* Secure-checkout strip — Amazon replaces the shop chrome with a plain
          "Checkout (N items)" bar and a padlock while you're in the pipeline. */}
      <div className="border-b border-[#e7e7e7]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold text-[#0f1111] sm:text-2xl">
            Checkout{" "}
            <span className="text-[13px] font-normal text-[#565959]">
              ({itemCount} {itemCount === 1 ? "item" : "items"})
            </span>
          </h1>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[#565959]">
            <Lock className="size-4" />
            Secure
          </span>
        </div>
      </div>

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {bookingItems.length === 0 ? (
          cartLoaded ? (
            <div className="mx-auto max-w-md rounded-lg border border-[#d5d9d9] bg-white py-16 text-center shadow-sm">
              <ShoppingCart className="mx-auto size-10 text-[#565959]" />
              <h2 className="mt-4 text-lg font-bold text-[#0f1111]">
                No products selected for checkout
              </h2>
              <p className="mt-1 text-[13px] text-[#565959]">
                Pick the items you want in your cart, then come back here.
              </p>
              <div className="mt-5 flex justify-center gap-3 px-6">
                <Link href="/products" className={`${YELLOW_CTA} h-9 w-auto px-6`}>
                  Browse products
                </Link>
              </div>
            </div>
          ) : (
            <p className="py-20 text-center text-sm font-semibold text-[#565959]">
              Loading your order...
            </p>
          )
        ) : (
          <form
            onSubmit={handlePlaceOrder}
            className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start"
          >
            {/* ─────────── Left column: the numbered checkout steps ─────────── */}
            <div className="min-w-0">
              {/* Step 1 — Shipping address */}
              <section className="border-b border-[#e7e7e7] pb-6">
                <StepHeading step="1" title="Shipping address" />

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className={FIELD_LABEL}>
                    Full name *
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={submitting}
                      required
                      placeholder="Enter recipient name"
                      className={FIELD}
                    />
                  </label>

                  <label className={FIELD_LABEL}>
                    Mobile number *
                    <PhoneField
                      value={phone}
                      onChange={setPhone}
                      disabled={submitting}
                      required
                      defaultCountry={country}
                      placeholder="Enter phone number"
                      borderClassName="border-[#888c8c]"
                      className="h-9 w-full bg-white shadow-[inset_0_1px_2px_rgba(15,17,17,0.15)] transition focus-within:border-[#e77600] focus-within:shadow-[0_0_3px_2px_rgba(228,121,17,0.5)]"
                      inputClassName="px-3 text-[13px] text-[#0f1111]"
                    />
                  </label>

                  <label className={`${FIELD_LABEL} sm:col-span-2`}>
                    Flat, House no., Building, Company, Apartment *
                    <input
                      type="text"
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                      disabled={submitting}
                      required
                      placeholder="Flat, House, Building, Street name"
                      className={FIELD}
                    />
                  </label>

                  <label className={`${FIELD_LABEL} sm:col-span-2`}>
                    Area, Street, Sector, Village{" "}
                    <span className="font-normal text-[#565959]">(optional)</span>
                    <input
                      type="text"
                      value={line2}
                      onChange={(e) => setLine2(e.target.value)}
                      disabled={submitting}
                      placeholder="Apartment, Colony, Area, Landmark"
                      className={FIELD}
                    />
                  </label>

                  <label className={FIELD_LABEL}>
                    Country / Region *
                    <CountrySelect
                      value={country}
                      onChange={(code) => {
                        setCountry(code);
                        // The state list changes with the country — clear any
                        // stale selection so it can't carry over.
                        setState("");
                      }}
                      disabled={submitting}
                      buttonClassName={FIELD}
                    />
                  </label>

                  <label className={FIELD_LABEL}>
                    {subdivisionLabel(country)} *
                    <StateField
                      country={country}
                      value={state}
                      onChange={setState}
                      disabled={submitting}
                      placeholder={subdivisionLabel(country)}
                      className={FIELD}
                    />
                  </label>

                  <label className={FIELD_LABEL}>
                    Town / City *
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      disabled={submitting}
                      required
                      placeholder="City name"
                      className={FIELD}
                    />
                  </label>

                  {/* The UAE (and the other markets in geo/postal.js) has no
                      postal-code system, so this stays optional there rather
                      than blocking a perfectly valid local address. */}
                  <label className={FIELD_LABEL}>
                    {postalCodeLabel(country)}
                    {needsPostalCode ? " *" : " (optional)"}
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      disabled={submitting}
                      required={needsPostalCode}
                      placeholder={postalCodeLabel(country)}
                      className={FIELD}
                    />
                  </label>
                </div>
              </section>

              {/* Step 2 — Payment method */}
              <section className="border-b border-[#e7e7e7] py-6">
                <StepHeading step="2" title="Payment method" />

                <div className="mt-4 overflow-hidden rounded-lg border border-[#d5d9d9]">
                  <div className="border-b border-[#e7e7e7] bg-[#f0f2f2] px-4 py-2 text-[13px] font-bold text-[#0f1111]">
                    Your available payment methods
                  </div>
                  <div className="divide-y divide-[#e7e7e7]">
                    {[
                      {
                        id: "COD",
                        label: "Cash on Delivery / Pay on Delivery",
                        desc: "Pay the delivery agent in cash when your order arrives. Cash on delivery is available for this address.",
                      },
                    ].map((gateway) => (
                      <label
                        key={gateway.id}
                        className="flex cursor-pointer items-start gap-3 px-4 py-3.5 transition hover:bg-[#f7fafa]"
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={gateway.id}
                          checked={paymentMethod === gateway.id}
                          onChange={() => setPaymentMethod(gateway.id)}
                          disabled={submitting}
                          className="mt-0.5 size-4 accent-[#007185]"
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-[13px] font-bold text-[#0f1111]">
                            <Banknote className="size-4 text-[#565959]" />
                            {gateway.label}
                          </span>
                          <span className="mt-1 block text-[12px] leading-4 text-[#565959]">
                            {gateway.desc}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </section>

              {/* Step 3 — Review items and delivery */}
              <section className="border-b border-[#e7e7e7] py-6">
                <StepHeading step="3" title="Review items and delivery" />

                <div className="mt-4 rounded-lg border border-[#d5d9d9]">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[#e7e7e7] px-4 py-3">
                    <Truck className="size-4 shrink-0 text-[#565959]" />
                    <span className="text-[15px] font-bold text-[#067d62]">
                      Estimated delivery: {deliveryWindow}
                    </span>
                    <span className="text-[12px] text-[#565959]">
                      {shipping === 0 ? "FREE Delivery" : `Delivery ${money(shipping)}`}
                    </span>
                  </div>

                  <ul className="divide-y divide-[#e7e7e7]">
                    {bookingItems.map((item) => (
                      <li key={item.productId} className="flex gap-4 p-4">
                        {item.imageMediaType === "VIDEO" && item.image ? (
                          // First frame only — see the cart thumbnail note.
                          <video
                            src={`${item.image}#t=0.1`}
                            muted
                            playsInline
                            preload="metadata"
                            aria-hidden="true"
                            className="size-20 shrink-0 rounded border border-[#d5d9d9] bg-[#f7fafa] object-cover"
                          />
                        ) : (
                          <span
                            className="size-20 shrink-0 rounded border border-[#d5d9d9] bg-[#f7fafa] bg-cover bg-center bg-no-repeat"
                            style={{
                              backgroundImage: `url('${
                                item.image ||
                                "https://images.pexels.com/photos/4871365/pexels-photo-4871365.jpeg?auto=compress&cs=tinysrgb&w=150"
                              }')`,
                            }}
                          />
                        )}

                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <Link
                            href={`/products/${item.slug}`}
                            className="line-clamp-2 text-[14px] font-bold leading-5 text-[#007185] transition hover:text-[#c7511f] hover:underline"
                          >
                            {item.name}
                          </Link>
                          <span className="text-[15px] font-bold text-[#b12704]">
                            {money(item.price)}
                          </span>
                          <span className="text-[12px] text-[#565959]">
                            Qty: {item.quantity} · Sold by{" "}
                            <span className="text-[#007185]">Ayursanthi</span>
                          </span>
                        </div>

                        <span className="shrink-0 self-center text-[14px] font-bold text-[#0f1111]">
                          {money(item.price * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="border-t border-[#e7e7e7] px-4 py-2.5 text-right text-[13px]">
                    Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"}):{" "}
                    <span className="text-[15px] font-bold text-[#b12704]">{money(subtotal)}</span>
                  </div>
                </div>

                {!buyNowMode && (
                  <Link
                    href="/cart"
                    className="mt-3 inline-block text-[13px] font-semibold text-[#007185] transition hover:text-[#c7511f] hover:underline"
                  >
                    Change quantities or remove items
                  </Link>
                )}
              </section>

              {/* Bottom place-order box — Amazon repeats the CTA and the total at
                  the end of the pipeline so you never scroll back up. */}
              <div className="mt-6 flex flex-col items-start gap-4 rounded-lg border border-[#d5d9d9] bg-[#f7fafa] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full sm:w-56">
                  {placeOrderButton}
                  <div className="mt-2">{termsNote}</div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[18px] font-bold text-[#b12704]">
                    Order total: {money(total)}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#565959]">
                    {TAX_INCLUSIVE_LABEL} · Payable in cash on delivery
                  </p>
                </div>
              </div>
            </div>

            {/* ─────────── Right column: sticky order summary ─────────── */}
            <aside className="lg:sticky lg:top-24">
              <div className="rounded-lg border border-[#d5d9d9] bg-white p-4">
                {placeOrderButton}
                <div className="mt-2">{termsNote}</div>

                <hr className="my-3 border-[#e7e7e7]" />

                <h2 className="mb-2 text-[18px] font-bold text-[#0f1111]">Order Summary</h2>
                {orderSummary}
              </div>

              {shipping > 0 && (
                <p className="mt-3 rounded-lg border border-[#d5d9d9] bg-[#f7fafa] p-3 text-[12px] leading-4 text-[#0f1111]">
                  Add <b>{money(freeShipThreshold - subtotal)}</b> of eligible items to your order to qualify
                  for <b>FREE Delivery</b>.
                </p>
              )}

              <div className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-[#565959]">
                <Lock className="size-3.5" />
                Secure transaction
              </div>
            </aside>

            {/* Bottom-of-content sentinel (normal flow, full width). The observer
                watches this — not the sticky panel — so the fixed bar reveals
                reliably across laptop and mobile viewports. */}
            <div ref={placeOrderRef} aria-hidden="true" className="h-px w-full lg:col-span-2" />

            {/* Fixed mobile footer — mirrors the place-order CTA once it scrolls
                away. Kept inside the form so it submits the same flow. */}
            <div
              className={`fixed inset-x-0 bottom-0 z-40 border-t border-[#d5d9d9] bg-white/95 shadow-[0_-4px_16px_rgba(15,17,17,0.08)] backdrop-blur transition-transform duration-300 ${
                showStickyBar ? "translate-y-0" : "pointer-events-none translate-y-full"
              }`}
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              aria-hidden={!showStickyBar}
            >
              <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
                <div className="hidden min-w-0 flex-1 sm:block">
                  <p className="text-[11px] text-[#565959]">Order total</p>
                  <p className="text-[18px] font-bold text-[#b12704]">{money(total)}</p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  tabIndex={showStickyBar ? 0 : -1}
                  className={`${YELLOW_CTA} h-9 sm:w-auto sm:px-10`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>Place your order · {money(total)}</>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      {/* Admin-managed banner slot — the only CMS-controlled element on the
          otherwise locked checkout page (Content Builder → Checkout). Appended
          below the checkout steps. */}
      <CheckoutBanner />

      <SiteFooter />
    </main>
  );
}
