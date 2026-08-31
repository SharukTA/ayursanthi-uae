"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CreditCard,
  Lock,
  ChevronRight,
  Loader2,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CheckoutBanner } from "@/components/CheckoutBanner";
import { PasswordField } from "@/components/PasswordField";
import { PhoneField } from "@/components/PhoneField";
import { CountrySelect, StateField } from "@/components/AddressFields";
import { PaymentMarks } from "@/components/PaymentMarks";
import { TermsNotice } from "@/components/TermsNotice";
import { validateRegistration } from "@/lib/validation";
import { getCountry } from "@/lib/geo/countries";
import { validateShippingAddress } from "@/lib/address";
import {
  calculateOrderTotals,
  FREE_SHIPPING_THRESHOLD,
  TAX_INCLUSIVE_LABEL,
} from "@/lib/pricing";
import { formatMoney } from "@/lib/currency";
import { getCart, readBuyNowItem } from "@/lib/cart-client";

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

// The same field, with its contents pushed to the bottom of the grid cell. The
// address labels are long enough that some wrap to two lines ("Building Name /
// Tower / Villa Community"); without this, the input under a wrapped label sits
// lower than the one beside it and the row looks broken.
const ADDRESS_FIELD_LABEL = `${FIELD_LABEL} content-end`;

// <PhoneField> styles its own shell and inner input, so it needs FIELD split in
// two to match the plain inputs around it.
const PHONE_SHELL =
  "h-9 w-full bg-white shadow-[inset_0_1px_2px_rgba(15,17,17,0.15)] transition focus-within:border-[#e77600] focus-within:shadow-[0_0_3px_2px_rgba(228,121,17,0.5)]";
const PHONE_INPUT = "px-3 text-[13px] text-[#0f1111]";

// The yellow primary CTA. A bare <button> on purpose — the shared <Button>
// variants are themed for dark surfaces, and the global CTA rules in globals.css
// only rewrite emerald/white buttons, so this keeps full control of the look.
const YELLOW_CTA =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#fcd200] bg-[#ffd814] px-4 text-[13px] font-bold text-[#0f1111] shadow-[0_2px_5px_rgba(15,17,17,0.15)] transition hover:bg-[#f7ca00] disabled:cursor-not-allowed disabled:opacity-60";

// Alias kept so the JSX below reads the same; the formatting itself is shared
// with the cart, the invoice and the order emails via lib/currency.js.
const money = formatMoney;

// Whether to offer online payment at all. The publishable key is the only sign
// of Stripe the browser can see, and it is set alongside the secret key, so its
// absence means this install has no gateway — better to hide the option than to
// offer a button that can only fail. NEXT_PUBLIC_ vars are inlined at build
// time, so this is a constant rather than a runtime lookup.
const ONLINE_PAYMENT_ENABLED = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

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

  // ── The inline account step (guests only) ──────────────────────────────────
  // A signed-out shopper authenticates here rather than being sent to /login,
  // so a purchase never leaves this page. Both tabs post to the very same
  // endpoints /login and /register use, which is what keeps validation, password
  // hashing, the welcome email and the session cookie identical no matter where
  // the account was created.
  const [authMode, setAuthMode] = useState("register");
  const [authBusy, setAuthBusy] = useState(false);
  const [accountErrors, setAccountErrors] = useState({});

  // "I'm new here" tab. There is no referral field here on purpose — that
  // belongs to the full signup on /register, not to a mid-purchase form.
  const [acctName, setAcctName] = useState("");
  const [acctEmail, setAcctEmail] = useState("");
  const [acctPhone, setAcctPhone] = useState("");
  const [acctPassword, setAcctPassword] = useState("");

  // "I already have an account" tab.
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // The account step sits above the address step, so the name and mobile typed
  // there seed the shipping fields — until the shopper edits those directly, at
  // which point the mirror stops rather than overwriting their correction.
  const shippingNameDirty = useRef(false);
  const shippingPhoneDirty = useRef(false);
  const shippingEmailDirty = useRef(false);

  const [cart, setCart] = useState([]);
  const [cartLoaded, setCartLoaded] = useState(false);

  // Which list the basket on screen came out of: "account" (the saved cart),
  // "guest" (a cart built in this browser while signed out) or "buynow" (a
  // single item that belongs to no cart at all). A purchase empties only the
  // list it came from, so buying a browser cart cannot delete the saved cart's
  // items — and vice versa — even when both name the same product.
  const [basketSource, setBasketSource] = useState(null);

  // "Buy Now" from a product page checks out a single item independently of the
  // shopping cart. When set, this checkout totals only the buy-now item and
  // leaves the cart (and its total) completely untouched.
  const [buyNowMode, setBuyNowMode] = useState(false);

  // Address fields, declared in the order the form asks for them. `country` is
  // an ISO2 code defaulting to the UAE — the store's home market, so the
  // overwhelming majority of shoppers never touch the selector. The snapshot
  // sent to the server carries the readable country name plus the code.
  //
  // There is deliberately no postal-code field: the UAE has no postal-code
  // system, and the building / community / villa number / landmark set below is
  // what a courier here actually navigates by. See lib/address.js.
  const [fullName, setFullName] = useState("");
  const [emirate, setEmirate] = useState("");
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState("");
  const [phone2, setPhone2] = useState("");
  const [building, setBuilding] = useState("");
  const [street, setStreet] = useState("");
  const [unit, setUnit] = useState("");
  const [landmark, setLandmark] = useState("");
  const [country, setCountry] = useState("AE");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Sentinel placed in normal flow at the bottom of the checkout content. While
  // it is off-screen (the customer hasn't scrolled down to the inline "Place
  // your order" box yet) we surface a fixed bar so they can confirm from
  // anywhere — Amazon's mobile checkout footer.
  const placeOrderRef = useRef(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  // Live free-shipping threshold (admin-editable); the constant is the fallback
  // until the settings fetch resolves. The server enforces the authoritative one.
  const [freeShipThreshold, setFreeShipThreshold] = useState(FREE_SHIPPING_THRESHOLD);

  // Back from Stripe without paying. The reservation has already been released
  // and nothing was charged, but the shopper has just been bounced between two
  // sites and deserves to be told that. Said once, then the flag is stripped
  // from the URL so a refresh does not repeat it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "cancelled") return;

    toast("Payment cancelled — you have not been charged.");

    // Give the reserved stock straight back. Fire-and-forget: the webhook's
    // session-expiry event does the same job for anyone who closed the tab
    // instead of coming back here, so a failed call costs half an hour of a
    // needlessly held reservation, nothing more.
    const cancelledOrderId = params.get("order");
    if (cancelledOrderId) {
      fetch("/api/checkout/stripe/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: cancelledOrderId }),
      }).catch(() => {});
    }

    params.delete("payment");
    params.delete("order");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`
    );
  }, []);

  // 1. Fetch Session & Cart
  useEffect(() => {
    // Leaving the page mid-request makes the browser reject the fetch. That is
    // not a failure, so the request is tied to the mount and the abort is told
    // apart from a real error below.
    const controller = new AbortController();

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/session", { signal: controller.signal });
        const data = await res.json();
        if (data.loggedIn) {
          setSession(data.session);
          setFullName(data.session.name || "");
          // The account's own address is the obvious place to send the order
          // confirmation; it stays editable for this particular delivery.
          setEmail(data.session.email || "");
        }
      } catch (e) {
        // An abort means the visitor navigated away — nothing went wrong and
        // there is nobody left to tell.
        if (e?.name === "AbortError") return;
        // The error itself, not just a sentence about it: logging a bare string
        // threw away the only thing that could say WHY the session call failed.
        console.error("Auth check failed:", e);
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
          setBasketSource("buynow");
          return;
        }
        // Either the saved account cart or, for a signed-out visitor, the cart
        // in their own browser — getCart() reports which one it handed back.
        const { items, source } = await getCart();
        setCart(items);
        setBasketSource(source === "guest" ? "guest" : "account");
      } catch (e) {
        console.error("Failed to load cart:", e);
      } finally {
        // Marks the read as done so the empty state only shows once we actually
        // know the basket is empty, rather than flashing during the first paint.
        setCartLoaded(true);
      }
    }

    loadBasket();

    return () => controller.abort();
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
  }, [authChecked, session, bookingItems.length]);

  const itemCount = bookingItems.reduce((acc, item) => acc + item.quantity, 0);
  // The order total is goods + delivery (see lib/pricing.js) — prices are
  // tax-inclusive, so nothing is added on top of them here or on the server.
  // The server recomputes all of this from DB prices before the order is created.
  const { subtotal, shipping, total } = calculateOrderTotals(
    bookingItems,
    freeShipThreshold
  );

  // Any in-flight work that must lock the form — creating the account and
  // placing the order are two phases of the same click.
  const busy = submitting || authBusy;

  // Guests get an extra step 1 (their account), which pushes the rest down one.
  const stepNo = (n) => String(session ? n : n + 1);

  // Server-side field errors from the account step, shown under their input.
  const fieldError = (field) =>
    accountErrors[field] ? (
      <span className="text-[12px] font-normal text-[#c40000]">{accountErrors[field]}</span>
    ) : null;

  const buildShippingAddress = () => ({
    fullName: fullName.trim(),
    emirate: emirate.trim(),
    area: area.trim(),
    phone: phone.trim(),
    phone2: phone2.trim() || undefined,
    building: building.trim(),
    street: street.trim(),
    unit: unit.trim(),
    landmark: landmark.trim(),
    country: getCountry(country)?.name || "",
    countryCode: country,
    email: email.trim(),
    whatsapp: whatsapp.trim(),
  });

  const clearAccountError = (field) =>
    setAccountErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  /**
   * Create an account for a guest on the "I'm new here" tab.
   *
   * Posts to the same /api/auth/register the standalone signup page uses, so the
   * user row, the password rules, the welcome email and the session cookie are
   * all exactly what a normal signup would produce.
   *
   * @returns {Promise<object|null>} the new user, or null if it could not be created
   */
  const registerGuest = async () => {
    const fieldErrors = validateRegistration({
      name: acctName,
      email: acctEmail,
      phone: acctPhone,
      password: acctPassword,
    });
    if (Object.keys(fieldErrors).length > 0) {
      setAccountErrors(fieldErrors);
      toast.error(Object.values(fieldErrors)[0]);
      return null;
    }
    setAccountErrors({});

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: acctName.trim(),
        email: acctEmail.trim(),
        phone: acctPhone.trim(),
        password: acctPassword,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (data.errors && typeof data.errors === "object") setAccountErrors(data.errors);

      // They are already a customer. Carrying them over to the sign-in tab with
      // the identifier prefilled is the difference between a one-click recovery
      // and a dead end halfway through a purchase.
      if (/already registered/i.test(data.message || "")) {
        setAuthMode("login");
        setLoginIdentifier(data.errors?.email ? acctEmail.trim() : acctPhone.trim());
        setAccountErrors({});
        toast.error(`${data.message} Please sign in to finish your order.`);
        return null;
      }

      toast.error(data.message || "Could not create your account.");
      return null;
    }

    toast.success("Account created.", {
      description: data.welcomeEmailSent
        ? `A welcome letter is on its way to ${acctEmail.trim()}.`
        : undefined,
    });
    return data.user;
  };

  /** Sign a returning customer in from the "I already have an account" tab. */
  const loginGuest = async () => {
    if (!loginIdentifier.trim() || !loginPassword) {
      toast.error("Please enter both your Login ID and password.");
      return null;
    }

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: loginIdentifier, password: loginPassword }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error(data.message || "Invalid login credentials.");
      return null;
    }

    toast.success(`Welcome back, ${data.user?.name || "there"}.`);
    return data.user;
  };

  /**
   * Run the account step for a guest: register, or sign in.
   *
   * Deliberately does NOT re-read the cart afterwards. What the shopper is
   * buying was decided before they identified themselves — it is the basket
   * already on screen — and the order is sent from that frozen list, so signing
   * in can never add, remove or re-total a line behind their back.
   *
   * That means a cart built while signed out is checked out on its own even when
   * the account has its own saved cart. The two are not combined here: the saved
   * cart is left untouched for later, and whatever is left in the browser cart
   * after this purchase merges the next time the shopper opens /cart.
   *
   * @returns {Promise<boolean>} true if the order may be placed on this click
   */
  const completeAccountStep = async () => {
    setAuthBusy(true);
    try {
      const user = authMode === "register" ? await registerGuest() : await loginGuest();
      if (!user) return false;

      setSession({
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });

      // An admin who signs in here cannot buy anything — the checkout API answers
      // 403. Setting the session above swaps the page over to the admin notice
      // instead of letting them submit into a rejection they can't act on. No
      // order follows, so the header can be told straight away.
      if (user.role === "ADMIN") {
        window.dispatchEvent(new Event("authUpdate"));
        return false;
      }

      return true;
    } catch {
      toast.error("We could not set up your account. Please try again.");
      return false;
    } finally {
      setAuthBusy(false);
    }
  };

  // Online payment: reserve the order, then hand the browser over to Stripe's
  // hosted page. Nothing is confirmed here — the order is still unpaid as we
  // navigate away, and only the webhook (or the return page) marks it paid.
  //
  // No cart is cleared on this path either. The shopper has not paid yet, and
  // an abandoned payment has to leave their basket exactly as they left it; the
  // tidying happens on the success page once the money is actually in.
  //
  // Resolves true once the redirect is under way, which tells the caller this
  // component is on its way out and should stop doing things.
  const submitStripeOrder = async (itemsBeingBought) => {
    setSubmitting(true);
    const toastId = toast.loading("Taking you to secure payment...");

    try {
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cart: itemsBeingBought.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          shippingAddress: buildShippingAddress(),
          cartSource: basketSource,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.message || "Could not start your payment.");
      }

      toast.dismiss(toastId);
      // Left submitting on purpose: the button stays disabled for the moment it
      // takes the browser to leave, so the order cannot be started twice.
      window.location.href = data.url;
      return true;
    } catch (error) {
      toast.error(error.message || "Something went wrong starting your payment.", {
        id: toastId,
      });
      setSubmitting(false);
      return false;
    }
  };

  // A single click now spans two round trips — create the account, then place
  // the order. That is a wide enough window for a double-click to run the whole
  // sequence twice before `busy` has re-rendered the button as disabled, which
  // would mean two accounts attempted and, worse, two orders. The latch is a ref
  // because it has to take effect synchronously, which state cannot.
  const placingRef = useRef(false);

  const runPlaceOrder = async () => {
    // Captured before the account step runs. This exact list is what the shopper
    // is looking at, and it is what gets ordered — identifying yourself is not
    // allowed to change the basket.
    const itemsBeingBought = bookingItems;

    if (itemsBeingBought.length === 0) {
      toast.error("Please select at least one product to check out.");
      return;
    }

    if (!ONLINE_PAYMENT_ENABLED) {
      toast.error("Online payment is unavailable right now. Please try again shortly.");
      return;
    }

    // Exactly the rules /api/checkout/stripe re-applies server-side - both sides
    // import them from lib/address.js, so the form can never accept an address
    // the server will then turn away.
    const addressError = validateShippingAddress(buildShippingAddress());
    if (addressError) {
      toast.error(addressError);
      return;
    }

    // Everything about the order checks out. Only now is the account created
    // or signed in to — doing it earlier would leave a stray user behind every
    // time someone abandoned the form at the address step.
    let signedInHere = false;
    if (!session) {
      const readyToOrder = await completeAccountStep();
      if (!readyToOrder) return;
      signedInHere = true;
    }

    // On success the browser is already on its way to Stripe, and the header
    // gets its refresh from the success page instead. Only a payment that failed
    // to even start falls through to the authUpdate below — which still matters,
    // because the account may have just been created here.
    const redirecting = await submitStripeOrder(itemsBeingBought);
    if (redirecting) return;

    // Only now tell the header it has a signed-in shopper. Its cart badge
    // refreshes on this event, and that refresh merges any browser cart into the
    // account — a merge that must not be racing the order, or it can land after
    // the order cleared the purchased lines and put them back. By this point a
    // successful order has already pruned what was bought from the browser cart,
    // so the merge that follows only carries what genuinely remains.
    if (signedInHere) window.dispatchEvent(new Event("authUpdate"));
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (placingRef.current) return;
    placingRef.current = true;
    try {
      await runPlaceOrder();
    } finally {
      placingRef.current = false;
    }
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

  // Admins manage the catalog and cannot book products. Reached either by an
  // admin opening /checkout directly, or by one signing in at the account step.
  if (session?.role === "ADMIN") {
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

  // The CTA names both phases of the click, so a guest knows an account is about
  // to be created before they press it rather than after. It says "pay" rather
  // than "place your order", because the order is not placed until Stripe
  // reports the money arrived.
  const placeOrderButton = (
    <button
      type="submit"
      disabled={busy || !ONLINE_PAYMENT_ENABLED}
      className={`${YELLOW_CTA} h-9`}
    >
      {busy ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {authBusy ? "Setting up your account..." : "Taking you to payment..."}
        </>
      ) : session ? (
        "Proceed to payment"
      ) : authMode === "register" ? (
        "Create account & pay"
      ) : (
        "Sign in & pay"
      )}
    </button>
  );

  // Names both halves of what the click does. For a guest on the "I'm new here"
  // tab the same button creates the account as well as paying, so the notice
  // has to cover the signup too — otherwise the account is made against terms
  // the shopper was never shown.
  const termsNote = (
    <TermsNotice action={!session && authMode === "register" ? "both" : "order"} />
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
              {/* Step 1 (guests only) — Account.
                  Signed-out shoppers used to be bounced to /login from here,
                  which is the worst moment to take someone off the page. They
                  now create an account or sign in inline and carry on. */}
              {!session && (
                <section className="border-b border-[#e7e7e7] pb-6">
                  <StepHeading step="1" title="Your account" />
                  <p className="mt-1.5 text-[13px] text-[#565959]">
                    Your order is saved to an account so you can track the delivery
                    and download the invoice afterwards.
                  </p>

                  <div role="tablist" aria-label="Account" className="mt-4 flex gap-2">
                    {[
                      { id: "register", label: "I am new here" },
                      { id: "login", label: "I already have an account" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={authMode === tab.id}
                        disabled={busy}
                        onClick={() => {
                          setAuthMode(tab.id);
                          setAccountErrors({});
                        }}
                        className={`h-9 flex-1 rounded-[3px] border px-2 text-[13px] font-bold transition disabled:opacity-60 sm:flex-none sm:px-5 ${
                          authMode === tab.id
                            ? "border-[#e77600] bg-[#fff8f0] text-[#0f1111] shadow-[0_0_3px_1px_rgba(228,121,17,0.35)]"
                            : "border-[#d5d9d9] bg-white text-[#565959] hover:bg-[#f7fafa]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {authMode === "register" ? (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className={FIELD_LABEL}>
                        Your name *
                        <input
                          type="text"
                          value={acctName}
                          onChange={(e) => {
                            setAcctName(e.target.value);
                            clearAccountError("name");
                            // Seed the shipping name until they edit it there.
                            if (!shippingNameDirty.current) setFullName(e.target.value);
                          }}
                          disabled={busy}
                          required
                          autoComplete="name"
                          aria-invalid={accountErrors.name ? "true" : undefined}
                          placeholder="First and last name"
                          className={FIELD}
                        />
                        {fieldError("name")}
                      </label>

                      <label className={FIELD_LABEL}>
                        Email *
                        <input
                          type="email"
                          value={acctEmail}
                          onChange={(e) => {
                            setAcctEmail(e.target.value);
                            clearAccountError("email");
                            // Seed the shipping email until they edit it there.
                            if (!shippingEmailDirty.current) setEmail(e.target.value);
                          }}
                          disabled={busy}
                          required
                          autoComplete="email"
                          aria-invalid={accountErrors.email ? "true" : undefined}
                          placeholder="you@example.com"
                          className={FIELD}
                        />
                        {fieldError("email")}
                      </label>

                      <label className={FIELD_LABEL}>
                        Mobile number *
                        <PhoneField
                          value={acctPhone}
                          onChange={(v) => {
                            setAcctPhone(v);
                            clearAccountError("phone");
                            if (!shippingPhoneDirty.current) setPhone(v);
                          }}
                          disabled={busy}
                          required
                          error={!!accountErrors.phone}
                          defaultCountry={country}
                          placeholder="Mobile number"
                          borderClassName="border-[#888c8c]"
                          className={PHONE_SHELL}
                          inputClassName={PHONE_INPUT}
                        />
                        {fieldError("phone")}
                      </label>

                      <label className={FIELD_LABEL}>
                        Create a password *
                        <PasswordField
                          value={acctPassword}
                          onChange={(e) => {
                            setAcctPassword(e.target.value);
                            clearAccountError("password");
                          }}
                          disabled={busy}
                          required
                          autoComplete="new-password"
                          aria-invalid={accountErrors.password ? "true" : undefined}
                          placeholder="At least 8 characters, with a letter and number"
                          className={FIELD}
                        />
                        {accountErrors.password ? (
                          fieldError("password")
                        ) : (
                          <span className="text-[12px] font-normal text-[#565959]">
                            You&apos;ll use this to sign in and track this order.
                          </span>
                        )}
                      </label>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className={FIELD_LABEL}>
                        Email or mobile number *
                        <input
                          type="text"
                          value={loginIdentifier}
                          onChange={(e) => setLoginIdentifier(e.target.value)}
                          disabled={busy}
                          required
                          autoComplete="username"
                          placeholder="you@example.com"
                          className={FIELD}
                        />
                      </label>

                      <label className={FIELD_LABEL}>
                        Password *
                        <PasswordField
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          disabled={busy}
                          required
                          autoComplete="current-password"
                          placeholder="Your account password"
                          className={FIELD}
                        />
                        <Link
                          href="/forgot-password"
                          className="text-[12px] font-normal text-[#007185] transition hover:text-[#c7511f] hover:underline"
                        >
                          Forgot your password?
                        </Link>
                      </label>
                    </div>
                  )}
                </section>
              )}

              {/* Shipping address — step 1 signed in, step 2 for a guest. */}
              <section
                className={`border-b border-[#e7e7e7] pb-6 ${session ? "" : "pt-6"}`}
              >
                <StepHeading step={stepNo(1)} title="Shipping address" />

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className={ADDRESS_FIELD_LABEL}>
                    Full Name *
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        shippingNameDirty.current = true;
                        setFullName(e.target.value);
                      }}
                      disabled={busy}
                      required
                      autoComplete="name"
                      placeholder="Enter recipient name"
                      className={FIELD}
                    />
                  </label>

                  {/* The seven emirates for a UAE delivery. Ship anywhere else
                      and the same control falls back to that country's state
                      list, or to free text where we have none — geo/states.js. */}
                  <label className={ADDRESS_FIELD_LABEL}>
                    Emirate / City *
                    <StateField
                      country={country}
                      value={emirate}
                      onChange={setEmirate}
                      disabled={busy}
                      placeholder="Emirate / City"
                      className={FIELD}
                    />
                  </label>

                  <label className={ADDRESS_FIELD_LABEL}>
                    Area / District *
                    <input
                      type="text"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      disabled={busy}
                      required
                      placeholder="e.g. Al Barsha 1, Al Nahda"
                      className={FIELD}
                    />
                  </label>

                  <label className={ADDRESS_FIELD_LABEL}>
                    Mobile Number (1) *
                    <PhoneField
                      value={phone}
                      onChange={(v) => {
                        shippingPhoneDirty.current = true;
                        setPhone(v);
                      }}
                      disabled={busy}
                      required
                      defaultCountry={country}
                      placeholder="Primary mobile number"
                      borderClassName="border-[#888c8c]"
                      className={PHONE_SHELL}
                      inputClassName={PHONE_INPUT}
                    />
                  </label>

                  {/* A second number is what saves a delivery when the first one
                      goes unanswered, so it is offered but never demanded. */}
                  <label className={ADDRESS_FIELD_LABEL}>
                    Mobile Number (2){" "}
                    <span className="font-normal text-[#565959]">(optional)</span>
                    <PhoneField
                      value={phone2}
                      onChange={setPhone2}
                      disabled={busy}
                      defaultCountry={country}
                      placeholder="Alternate mobile number"
                      borderClassName="border-[#888c8c]"
                      className={PHONE_SHELL}
                      inputClassName={PHONE_INPUT}
                    />
                  </label>

                  <label className={ADDRESS_FIELD_LABEL}>
                    Building Name / Tower / Villa Community *
                    <input
                      type="text"
                      value={building}
                      onChange={(e) => setBuilding(e.target.value)}
                      disabled={busy}
                      required
                      placeholder="e.g. Marina Heights Tower"
                      className={FIELD}
                    />
                  </label>

                  <label className={`${ADDRESS_FIELD_LABEL} sm:col-span-2`}>
                    Sub-Cluster / Phase / Street Name *
                    <input
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      disabled={busy}
                      required
                      placeholder="e.g. Cluster D, Phase 2, Al Wasl Road"
                      className={FIELD}
                    />
                  </label>

                  <label className={ADDRESS_FIELD_LABEL}>
                    Apartment / Villa / Office Number *
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      disabled={busy}
                      required
                      placeholder="e.g. Apt 1204, Villa 27, Office 5"
                      className={FIELD}
                    />
                  </label>

                  <label className={ADDRESS_FIELD_LABEL}>
                    Nearest Landmark *
                    <input
                      type="text"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      disabled={busy}
                      required
                      placeholder="e.g. Mall of the Emirates"
                      className={FIELD}
                    />
                  </label>

                  <label className={ADDRESS_FIELD_LABEL}>
                    Country *
                    <CountrySelect
                      value={country}
                      onChange={(code) => {
                        setCountry(code);
                        // The emirate/state list changes with the country, so a
                        // choice made against the old one must not carry over.
                        setEmirate("");
                      }}
                      disabled={busy}
                      buttonClassName={FIELD}
                    />
                  </label>

                  <label className={ADDRESS_FIELD_LABEL}>
                    E mail *
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        shippingEmailDirty.current = true;
                        setEmail(e.target.value);
                      }}
                      disabled={busy}
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={FIELD}
                    />
                  </label>

                  <label className={ADDRESS_FIELD_LABEL}>
                    Whatsapp Number *
                    <PhoneField
                      value={whatsapp}
                      onChange={setWhatsapp}
                      disabled={busy}
                      required
                      defaultCountry={country}
                      placeholder="WhatsApp number"
                      borderClassName="border-[#888c8c]"
                      className={PHONE_SHELL}
                      inputClassName={PHONE_INPUT}
                    />
                  </label>
                </div>
              </section>

              {/* Step 2 — Payment method */}
              <section className="border-b border-[#e7e7e7] py-6">
                <StepHeading step={stepNo(2)} title="Payment method" />

                <div className="mt-4 overflow-hidden rounded-lg border border-[#d5d9d9]">
                  <div className="border-b border-[#e7e7e7] bg-[#f0f2f2] px-4 py-2 text-[13px] font-bold text-[#0f1111]">
                    Your available payment methods
                  </div>
                  {/* One method, so there is nothing to choose between — a lone
                      radio button asking to be selected is just an extra click. */}
                  {ONLINE_PAYMENT_ENABLED ? (
                    <div className="flex items-start gap-3 px-4 py-3.5">
                      <CreditCard className="mt-0.5 size-4 shrink-0 text-[#565959]" />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold text-[#0f1111]">
                          Card, Apple Pay or Google Pay
                        </span>
                        <span className="mt-1 block text-[12px] leading-4 text-[#565959]">
                          You pay on Stripe&apos;s secure page. Your card details never touch this
                          site, and your order is confirmed the moment the payment clears.
                        </span>
                        <PaymentMarks className="mt-2.5 justify-start" />
                      </span>
                    </div>
                  ) : (
                    <div className="px-4 py-3.5 text-[12px] leading-4 text-[#b12704]">
                      Online payment is temporarily unavailable, so orders cannot be placed right
                      now. Please try again shortly — nothing in your basket will be lost.
                    </div>
                  )}
                </div>
              </section>

              {/* Step 3 — Review items and delivery */}
              <section className="border-b border-[#e7e7e7] py-6">
                <StepHeading step={stepNo(3)} title="Review items and delivery" />

                <div className="mt-4 rounded-lg border border-[#d5d9d9]">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[#e7e7e7] px-4 py-3">
                    <Truck className="size-4 shrink-0 text-[#565959]" />
                    <span className="text-[15px] font-bold text-[#067d62]">
                      {shipping === 0 ? "FREE Delivery" : `Delivery ${money(shipping)}`}
                    </span>
                    <span className="text-[12px] text-[#565959]">
                      Shipped by our courier partner — we&apos;ll email you when it&apos;s on its way
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
                  the end of the pipeline so you never scroll back up. Only worth
                  showing once the summary is a sticky side panel: below lg the
                  aside stacks directly underneath and already repeats both the
                  CTA and the total, so this box is hidden there. */}
              <div className="mt-6 hidden flex-col items-start gap-4 rounded-lg border border-[#d5d9d9] bg-[#f7fafa] p-4 sm:flex-row sm:items-center sm:justify-between lg:flex">
                <div className="w-full sm:w-56">
                  {placeOrderButton}
                  <div className="mt-2">{termsNote}</div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[18px] font-bold text-[#b12704]">
                    Order total: {money(total)}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#565959]">
                    {TAX_INCLUSIVE_LABEL} · Payable now, securely
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
              <PaymentMarks className="mt-2" />
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
                  disabled={busy || !ONLINE_PAYMENT_ENABLED}
                  tabIndex={showStickyBar ? 0 : -1}
                  className={`${YELLOW_CTA} h-9 sm:w-auto sm:px-10`}
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Processing...
                    </>
                  ) : session ? (
                    <>Proceed to payment · {money(total)}</>
                  ) : (
                    <>
                      {authMode === "register" ? "Create account" : "Sign in"} &amp; order ·{" "}
                      {money(total)}
                    </>
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
