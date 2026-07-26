"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart, CreditCard, Plus, Minus, ShieldAlert, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProductActions({ product, pdfHref }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);

  // The inline action buttons. When they scroll out of the viewport we surface
  // a fixed bar pinned to the bottom of the screen so Add to Cart / Buy Now stay
  // reachable no matter how far the customer has scrolled.
  const actionsRef = useRef(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  // Admins manage the catalog and are not allowed to book products.
  useEffect(() => {
    let active = true;
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (active && data.loggedIn && data.session?.role === "ADMIN") {
          setIsAdmin(true);
        }
      } catch {
        // Ignore: default to treating the visitor as a customer.
      }
    }
    loadSession();
    return () => {
      active = false;
    };
  }, []);

  // Watch the inline buttons: show the fixed bar only while they are off-screen.
  useEffect(() => {
    const el = actionsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isAdmin]);

  const increment = () => {
    if (quantity < product.stock) {
      setQuantity(quantity + 1);
    } else {
      toast.warning(`Only ${product.stock} units are in stock.`);
    }
  };

  const decrement = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  // Snapshot of the current product as a cart/checkout line item.
  const buildLineItem = () => ({
    productId: product.id,
    name: product.name,
    // Pack size travels with the line so the cart can tell two sizes of the same
    // product apart. Display only — never used in any calculation.
    netQuantity: product.netQuantity || null,
    price: Number(product.price),
    // Carried so the cart/checkout can preview GST and delivery accurately; the
    // server still recomputes both from the DB before charging anything.
    gstRate: Number(product.gstRate) || 0,
    shippingFee: Number(product.shippingFee) || 0,
    image: product.images?.[0]?.url || "",
    // Snapshot the media type too: a video-first product must render as a
    // <video> in the cart, not as a (silently blank) background-image.
    imageMediaType: product.images?.[0]?.mediaType || null,
    slug: product.slug,
    quantity: quantity,
    selected: true,
  });

  const handleAddToCart = () => {
    if (product.stock <= 0) {
      toast.error("This product is currently out of stock.");
      return;
    }

    try {
      const cart = JSON.parse(localStorage.getItem("ayursanthi_cart") || "[]");
      const existingIdx = cart.findIndex((item) => item.productId === product.id);

      if (existingIdx > -1) {
        cart[existingIdx].quantity += quantity;
        cart[existingIdx].selected = true;
      } else {
        cart.push(buildLineItem());
      }

      localStorage.setItem("ayursanthi_cart", JSON.stringify(cart));

      // Dispatch custom cart event to refresh cart counts in Header
      window.dispatchEvent(new Event("cartUpdate"));

      toast.success(`Added ${quantity} x ${product.name} to your shopping cart.`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update cart storage.");
    }
  };

  // "Buy Now" is independent of the cart: it never adds the product to the
  // shopping cart. Instead we stash this single line item (with its chosen
  // quantity) under a separate key and send the customer straight to checkout,
  // which reads it via ?buynow=1. The cart and its total are left untouched.
  const handleBuyNow = () => {
    if (product.stock <= 0) {
      toast.error("This product is currently out of stock.");
      return;
    }

    try {
      localStorage.setItem("ayursanthi_buynow", JSON.stringify(buildLineItem()));
      toast.success("Opening checkout...");
      router.push("/checkout?buynow=1");
    } catch (err) {
      console.error(err);
      toast.error("Failed to start checkout.");
    }
  };

  // Admins can view product details but cannot add to cart or check out.
  if (isAdmin) {
    return (
      <div className="mt-6 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
        <ShieldAlert className="size-5 shrink-0 text-amber-700" />
        <div>
          <p className="text-sm font-bold text-amber-900">Admin view only</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">
            You are signed in as an administrator. Product booking is available to
            customer accounts only — use the admin panel to manage this product instead.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {/* Quantity Adjuster */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-[#0f1111] uppercase tracking-wide">
          Quantity:
        </span>
        <div className="flex items-center rounded-md border border-border bg-slate-150 p-1">
          <button
            type="button"
            onClick={decrement}
            disabled={quantity <= 1}
            className="flex size-8 items-center justify-center rounded bg-white text-slate-800 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <Minus className="size-3" />
          </button>
          <span className="w-10 text-center text-sm font-bold text-[#0f1111]">
            {quantity}
          </span>
          <button
            type="button"
            onClick={increment}
            disabled={quantity >= product.stock}
            className="flex size-8 items-center justify-center rounded bg-white text-slate-800 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <Plus className="size-3" />
          </button>
        </div>
        <span className="text-xs text-[#565959] font-medium">
          ({product.stock} units available)
        </span>
      </div>

      {/* Action Buttons */}
      <div ref={actionsRef} className="mt-2 grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          onClick={handleAddToCart}
          variant="secondary"
          className="h-12 rounded-md ring-0 bg-[#FFD814] text-[#0F1111] hover:bg-[#F7CA00] text-sm font-semibold"
        >
          <ShoppingCart className="size-4 mr-2" />
          Add to Cart
        </Button>

        <Button
          type="button"
          onClick={handleBuyNow}
          variant="secondary"
          className="h-12 rounded-md ring-0 bg-[#FFA41C] text-[#0F1111] hover:bg-[#FF9000] text-sm font-semibold"
        >
          <CreditCard className="size-4 mr-2" />
          Buy Now
        </Button>
      </div>

      {/* Sticky bar — mirrors the buttons above once they scroll out of view. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-emerald-100 bg-white/95 backdrop-blur shadow-[0_-4px_16px_rgba(0,0,0,0.08)] transition-transform duration-300 ${
          showStickyBar ? "translate-y-0" : "translate-y-full pointer-events-none"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-hidden={!showStickyBar}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          {/* Product summary — hidden on the smallest screens to give buttons room. */}
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-sm font-bold text-[#0f1111]">{product.name}</p>
            <p className="text-sm font-extrabold text-emerald-800">
              Rs. {Number(product.price).toLocaleString()}
            </p>
          </div>

          {/* Download PDF — sits to the LEFT of Add to Cart so it never overlaps
              the buy buttons. Icon-only on mobile to keep the buttons room. */}
          {pdfHref ? (
            <a
              href={pdfHref}
              aria-label="Download product details as PDF"
              tabIndex={showStickyBar ? 0 : -1}
              className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-50 sm:px-4"
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">PDF</span>
            </a>
          ) : null}

          <div className="grid flex-1 grid-cols-2 gap-3 sm:flex-none">
            <Button
              type="button"
              onClick={handleAddToCart}
              variant="secondary"
              tabIndex={showStickyBar ? 0 : -1}
              className="h-11 rounded-md ring-0 bg-[#FFD814] text-[#0F1111] hover:bg-[#F7CA00] text-sm font-semibold sm:px-6"
            >
              <ShoppingCart className="size-4 mr-2" />
              Add to Cart
            </Button>

            <Button
              type="button"
              onClick={handleBuyNow}
              variant="secondary"
              tabIndex={showStickyBar ? 0 : -1}
              className="h-11 rounded-md ring-0 bg-[#FFA41C] text-[#0F1111] hover:bg-[#FF9000] text-sm font-semibold sm:px-6"
            >
              <CreditCard className="size-4 mr-2" />
              Buy Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
