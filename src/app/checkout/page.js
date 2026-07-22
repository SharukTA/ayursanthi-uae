"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Banknote,
  MapPin,
  Lock,
  CheckCircle,
  ChevronRight,
  Loader2,
  ShoppingCart
} from "lucide-react";
import { FadeIn, PageReveal, Stagger, StaggerItem } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { CheckoutBanner } from "@/components/CheckoutBanner";
import { AnimatedHeading } from "@/components/AnimatedText";
import { Tilt3D } from "@/components/Tilt3D";
import { validatePhone } from "@/lib/validation";

export default function CheckoutPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  
  const [cart, setCart] = useState([]);
  const [cartLoaded, setCartLoaded] = useState(false);

  // "Buy Now" from a product page checks out a single item independently of the
  // shopping cart. When set, this checkout totals only the buy-now item and
  // leaves the cart (and its total) completely untouched.
  const [buyNowMode, setBuyNowMode] = useState(false);

  // Address Fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  
  // Cash on Delivery is currently the only way to pay — no online gateway.
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [placedOrderDetails, setPlacedOrderDetails] = useState(null);

  // Sentinel placed in normal flow at the bottom of the checkout content. While
  // it is off-screen (the customer hasn't scrolled down to the inline "Place
  // Order" button yet) we surface a fixed bar so they can confirm from anywhere.
  // We watch a plain sentinel rather than the inline button itself because that
  // button sits inside an `lg:sticky` + Tilt3D (CSS transform) container, whose
  // positioning quirks stop the observer from firing on laptop viewports.
  const placeOrderRef = useRef(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

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

    try {
      // ?buynow=1 means we arrived here straight from a product page's "Buy Now"
      // and should check out only that single stashed item — not the cart.
      const isBuyNow =
        new URLSearchParams(window.location.search).get("buynow") === "1";
      setBuyNowMode(isBuyNow);

      if (isBuyNow) {
        const item = JSON.parse(localStorage.getItem("ayursanthi_buynow") || "null");
        setCart(item ? [item] : []);
      } else {
        const storedCart = JSON.parse(localStorage.getItem("ayursanthi_cart") || "[]");
        setCart(storedCart);
      }
    } catch (e) {
      console.error("Failed to load cart.");
    } finally {
      setCartLoaded(false);
    }
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

  const subtotal = bookingItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const tax = parseFloat((subtotal * 0.18).toFixed(2));
  const shipping = subtotal === 0 ? 0 : subtotal >= 1000 ? 0.0 : 99.0;
  const total = parseFloat((subtotal + tax + shipping).toFixed(2));

  const buildShippingAddress = () => ({
    fullName: fullName.trim(),
    phone: phone.trim(),
    line1: line1.trim(),
    line2: line2.trim() || undefined,
    city: city.trim(),
    state: state.trim(),
    postalCode: postalCode.trim(),
    country: "India",
  });

  const onOrderSuccess = (data) => {
    toast.success("Order Placed Successfully!");
    if (buyNowMode) {
      // Buy-now never touched the cart — just discard the one-off item.
      localStorage.removeItem("ayursanthi_buynow");
    } else {
      // Keep any unselected items in the cart; only clear what was purchased.
      const remaining = cart.filter((item) => item.selected === false);
      if (remaining.length > 0) {
        localStorage.setItem("ayursanthi_cart", JSON.stringify(remaining));
      } else {
        localStorage.removeItem("ayursanthi_cart");
      }
    }
    window.dispatchEvent(new Event("cartUpdate"));
    setPlacedOrderDetails({
      orderNumber: data.orderNumber,
      totalAmount: total,
      address: `${line1}, ${city}, ${state} - ${postalCode}`,
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

    if (!fullName.trim() || !phone.trim() || !line1.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
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
      <main className="min-h-screen bg-slate-50 text-white flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-semibold text-slate-500">Checking your authorization status...</p>
        </div>
        <SiteFooter />
      </main>
    );
  }

  // Not Logged In screen
  if (!session) {
    return (
      <main className="min-h-screen bg-slate-50 text-white flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-md border border-border p-6 shadow-sm text-center">
            <Lock className="size-12 text-slate-400 mx-auto" />
            <h2 className="mt-5 text-xl font-bold text-slate-950">Secure Checkout Required</h2>
            <p className="mt-2 text-sm text-slate-500">You must be logged in as a registered customer to complete your order booking.</p>
            <div className="mt-6 flex flex-col gap-3">
              <Button asChild className="h-11 bg-emerald-700 hover:bg-emerald-800 rounded-md">
                <Link href="/login">
                  Log In Account
                  <ChevronRight className="size-4 ml-1" />
                </Link>
              </Button>
              <Link href="/register" className="text-xs font-semibold text-slate-500 hover:text-emerald-700 transition">
                Create new account instead
              </Link>
            </div>
          </div>
        </div>
        <SiteFooter />
      </main>
    );
  }

  // Admins manage the catalog and cannot book products.
  if (session.role === "ADMIN") {
    return (
      <main className="min-h-screen bg-slate-50 text-white flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-md border border-border p-6 shadow-sm text-center">
            <Lock className="size-12 text-amber-500 mx-auto" />
            <h2 className="mt-5 text-xl font-bold text-slate-950">Booking Not Available for Admins</h2>
            <p className="mt-2 text-sm text-slate-500">
              You are signed in as an administrator. Product booking is reserved for customer
              accounts. You can manage products and categories from the admin panel.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Button asChild className="h-11 bg-emerald-700 hover:bg-emerald-800 rounded-md">
                <Link href="/admin">
                  Go to Admin Panel
                  <ChevronRight className="size-4 ml-1" />
                </Link>
              </Button>
              <Link href="/products" className="text-xs font-semibold text-slate-500 hover:text-emerald-700 transition">
                Browse products instead
              </Link>
            </div>
          </div>
        </div>
        <SiteFooter />
      </main>
    );
  }

  // Successful Checkout overlay screen
  if (orderSuccess && placedOrderDetails) {
    return (
      <main className="min-h-screen bg-slate-50 text-white flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center p-4">
          <PageReveal className="max-w-lg w-full bg-white rounded-md border border-border p-8 shadow-xl text-center">
            <CheckCircle className="size-16 text-emerald-600 mx-auto" />
            <h2 className="mt-5 text-2xl font-bold text-slate-950">Order Placed Successfully!</h2>
            <p className="mt-2 text-sm text-slate-500">
              Thank you for your purchase. Please keep the cash ready — you pay the delivery
              agent when your order arrives.
            </p>

            {/* Receipt Summary Box */}
            <div className="mt-6 rounded-md bg-slate-50 border border-border p-5 text-left text-xs font-medium text-slate-650 space-y-3">
              <div className="flex justify-between border-b border-slate-200 pb-2.5 font-bold text-slate-950">
                <span>Invoice Number</span>
                <span className="font-mono text-emerald-800">{placedOrderDetails.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Payable on Delivery</span>
                <span className="font-extrabold text-slate-950">Rs. {placedOrderDetails.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-1 border-t border-slate-200 pt-2.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wide">Shipping Destination</span>
                <span className="text-slate-800 leading-5">{placedOrderDetails.address}</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild className="h-11 bg-emerald-700 hover:bg-emerald-800 rounded-md flex-1">
                <Link href="/products">
                  Shop More Remedies
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-md flex-1">
                <Link href="/">
                  Return Home
                </Link>
              </Button>
            </div>
          </PageReveal>
        </div>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />


      {/* Checkout Content Grid */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 flex-1 w-full">
        {bookingItems.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-md border border-border shadow-sm max-w-md mx-auto">
            <ShoppingCart className="size-12 text-slate-350 mx-auto" />
            <h2 className="mt-4 text-base font-bold text-slate-900">No products selected for checkout</h2>
            <Button asChild className="mt-5 bg-emerald-700 hover:bg-emerald-800 rounded-md text-xs">
              <Link href="/products">Browse products</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handlePlaceOrder} className="grid gap-8 lg:grid-cols-[1fr_380px]">
            
            {/* Left side: Inputs */}
            <div className="flex flex-col gap-6">
              
              {/* Address Frame */}
              <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <MapPin className="size-5 text-emerald-700" />
                  Shipping Address details
                </h2>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
                    Recipient Full Name *
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={submitting}
                      required
                      placeholder="Enter recipient name"
                      className="w-full min-w-0 min-h-11 rounded border border-input bg-white px-4 text-xs font-normal outline-none transition focus:border-emerald-700"
                    />
                  </label>

                  <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
                    Contact Phone Number *
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={submitting}
                      required
                      placeholder="Enter phone number"
                      className="w-full min-w-0 min-h-11 rounded border border-input bg-white px-4 text-xs font-normal outline-none transition focus:border-emerald-700"
                    />
                  </label>

                  <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800 sm:col-span-2">
                    Address Line 1 *
                    <input
                      type="text"
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                      disabled={submitting}
                      required
                      placeholder="Flat, House, Building, Street name"
                      className="w-full min-w-0 min-h-11 rounded border border-input bg-white px-4 text-xs font-normal outline-none transition focus:border-emerald-700"
                    />
                  </label>

                  <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800 sm:col-span-2">
                    Address Line 2 (Optional)
                    <input
                      type="text"
                      value={line2}
                      onChange={(e) => setLine2(e.target.value)}
                      disabled={submitting}
                      placeholder="Apartment, Colony, Area, Landmark"
                      className="w-full min-w-0 min-h-11 rounded border border-input bg-white px-4 text-xs font-normal outline-none transition focus:border-emerald-700"
                    />
                  </label>

                  <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
                    City / Town *
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      disabled={submitting}
                      required
                      placeholder="City name"
                      className="w-full min-w-0 min-h-11 rounded border border-input bg-white px-4 text-xs font-normal outline-none transition focus:border-emerald-700"
                    />
                  </label>

                  <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
                    State / Region *
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      disabled={submitting}
                      required
                      placeholder="State name"
                      className="w-full min-w-0 min-h-11 rounded border border-input bg-white px-4 text-xs font-normal outline-none transition focus:border-emerald-700"
                    />
                  </label>

                  <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
                    Postal PIN Code *
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      disabled={submitting}
                      required
                      placeholder="6-digit ZIP code"
                      className="w-full min-w-0 min-h-11 rounded border border-input bg-white px-4 text-xs font-normal outline-none transition focus:border-emerald-700"
                    />
                  </label>

                  <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
                    Country
                    <input
                      type="text"
                      disabled
                      value="India"
                      className="w-full min-w-0 min-h-11 rounded border border-input bg-slate-50 px-4 text-xs font-normal outline-none"
                    />
                  </label>
                </div>
              </FadeIn>

              {/* Payment selection Frame */}
              <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Banknote className="size-5 text-emerald-700" />
                  Select Payment Option
                </h2>

                <div className="mt-5 grid gap-3">
                  {[
                    { id: "COD", label: "Cash on Delivery", desc: "Pay the delivery agent in cash when your order arrives" }
                  ].map((gateway) => (
                    <label 
                      key={gateway.id} 
                      className={`flex items-start gap-3 rounded-md border p-4 cursor-pointer transition ${
                        paymentMethod === gateway.id 
                          ? "border-emerald-700 bg-emerald-50/20" 
                          : "border-border hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={gateway.id}
                        checked={paymentMethod === gateway.id}
                        onChange={() => setPaymentMethod(gateway.id)}
                        disabled={submitting}
                        className="size-4 mt-0.5 accent-emerald-750"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">{gateway.label}</span>
                        <span className="text-[10px] text-slate-500 block mt-1">{gateway.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </FadeIn>
            </div>

            {/* Right side: Invoice pricing breakdown */}
            <FadeIn>
              <Tilt3D maxTilt={5} scale={1.01}>
              <div className="rounded-md border border-border bg-white p-5 shadow-sm flex flex-col gap-5 sm:p-6 lg:sticky lg:top-24">
                <AnimatedHeading
                  as="h2"
                  text="Items in Booking"
                  className="text-lg font-bold text-slate-950 border-b border-slate-150 pb-3"
                  highlightWords={["Booking"]}
                  highlightClassName=""
                />

                {/* mini cart breakdown */}
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 pr-1">
                  {bookingItems.map((item) => (
                    <div key={item.productId} className="flex justify-between py-2 text-xs text-slate-650">
                      <span className="truncate max-w-[200px]">
                        {item.name} <span className="text-slate-400 font-bold">x {item.quantity}</span>
                      </span>
                      <span className="font-bold text-slate-900">
                        Rs. {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 text-xs font-medium text-slate-650 border-t border-slate-150 pt-4">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-bold text-slate-950">Rs. {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (18%)</span>
                    <span className="font-bold text-slate-950">Rs. {tax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping Charges</span>
                    <span className="font-bold text-slate-950">
                      {shipping === 0 ? "FREE" : `Rs. ${shipping.toLocaleString()}`}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-150 pt-4 flex justify-between font-extrabold text-slate-950">
                  <span className="text-sm">Total Amount</span>
                  <span className="text-base text-emerald-800">Rs. {total.toLocaleString()}</span>
                </div>

                <Button
                  type="submit"
                  variant="secondary"
                  disabled={submitting}
                  className="h-12 bg-[#FFD814] hover:bg-[#f7ca00] text-[#000000] rounded-md text-sm font-semibold mt-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Placing order...
                    </>
                  ) : (
                    <>
                      Confirm & Place Order (Rs. {total.toLocaleString()})
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  <Banknote className="size-3.5" />
                  Pay Cash on Delivery
                </div>
              </div>
              </Tilt3D>
            </FadeIn>

            {/* Bottom-of-content sentinel (normal flow, full width). The observer
                watches this — not the sticky inline button — so the fixed bar
                reveals reliably across laptop and mobile viewports. */}
            <div ref={placeOrderRef} aria-hidden="true" className="h-px w-full lg:col-span-2" />

            {/* Sticky bar — mirrors the place-order button once it scrolls away.
                Kept inside the form so it submits the same checkout flow. */}
            <div
              className={`fixed inset-x-0 bottom-0 z-40 border-t border-emerald-100 bg-white/95 backdrop-blur shadow-[0_-4px_16px_rgba(0,0,0,0.08)] transition-transform duration-300 ${
                showStickyBar ? "translate-y-0" : "translate-y-full pointer-events-none"
              }`}
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              aria-hidden={!showStickyBar}
            >
              <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
                <div className="hidden min-w-0 flex-1 sm:block">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Total Amount
                  </p>
                  <p className="text-base font-extrabold text-emerald-800">
                    Rs. {total.toLocaleString()}
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="secondary"
                  disabled={submitting}
                  tabIndex={showStickyBar ? 0 : -1}
                  className="h-11 flex-1 bg-[#FFD814] hover:bg-[#f7ca00] text-[#000000] rounded-md text-sm font-semibold sm:flex-none sm:px-8"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Lock className="size-4 mr-2" />
                      Place Order (Rs. {total.toLocaleString()})
                    </>
                  )}
                </Button>
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
