"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Trash2, Plus, Minus, ArrowLeft, ArrowRight, ShoppingCart } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { AnimatedHeading } from "@/components/AnimatedText";
import { Tilt3D } from "@/components/Tilt3D";
import { calculateOrderTotals, FREE_SHIPPING_THRESHOLD } from "@/lib/pricing";

export default function CartPage() {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  // Live free-shipping threshold (admin-editable); falls back to the constant
  // until the settings fetch resolves. The server enforces the real value.
  const [freeShipThreshold, setFreeShipThreshold] = useState(FREE_SHIPPING_THRESHOLD);

  // Load cart from localStorage on component mount
  useEffect(() => {
    try {
      const storedCart = JSON.parse(localStorage.getItem("ayursanthi_cart") || "[]");
      setCart(storedCart);
    } catch (e) {
      console.error("Failed to load cart.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Pull the current free-shipping threshold so the summary matches checkout.
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

  // Persist any cart change to localStorage and let the header badge refresh.
  const persistCart = (updated) => {
    setCart(updated);
    localStorage.setItem("ayursanthi_cart", JSON.stringify(updated));
    window.dispatchEvent(new Event("cartUpdate"));
  };

  const updateQuantity = (productId, amount) => {
    const updated = cart.map((item) => {
      if (item.productId === productId) {
        const newQty = item.quantity + amount;
        return { ...item, quantity: newQty > 0 ? newQty : 1 };
      }
      return item;
    });
    persistCart(updated);
  };

  const removeItem = (productId, name) => {
    persistCart(cart.filter((item) => item.productId !== productId));
    toast.success(`Removed ${name} from your cart.`);
  };

  // Items without the flag are treated as selected (backward compatible with
  // carts saved before checkboxes existed). Only selected items are checked out.
  const isSelected = (item) => item.selected !== false;

  const toggleSelect = (productId) => {
    persistCart(
      cart.map((item) =>
        item.productId === productId ? { ...item, selected: item.selected === false } : item
      )
    );
  };

  const allSelected = cart.length > 0 && cart.every(isSelected);

  const toggleSelectAll = () => {
    const next = !allSelected;
    persistCart(cart.map((item) => ({ ...item, selected: next })));
  };

  // Clicking a product opens its details page, and removes it from the cart.
  const handleViewDetails = (productId, name) => {
    persistCart(cart.filter((item) => item.productId !== productId));
    toast.message(`Opening ${name} — removed from your cart.`);
  };

  // Pricing calculations — based only on the items the customer has selected.
  // Prices are GST-inclusive, so `tax` is the portion already inside `subtotal`;
  // the total is goods + delivery (see lib/pricing.js). The server recomputes it
  // all from the DB at checkout.
  const selectedItems = cart.filter(isSelected);
  const selectedCount = selectedItems.reduce((acc, item) => acc + item.quantity, 0);
  const { subtotal, tax, shipping, total } = calculateOrderTotals(
    selectedItems,
    freeShipThreshold
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 text-white flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-semibold text-white">Loading your shopping cart...</p>
        </div>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />


      {/* Main Grid Content */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 flex-1 w-full">
        {cart.length === 0 ? (
          <div className="text-center py-20 rounded-md border border-dashed border-border bg-white shadow-sm max-w-2xl mx-auto">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#232f3e] text-white">
              <ShoppingCart className="size-6" />
            </div>
            <h2 className="mt-5 text-lg font-bold text-[#0f1111]">Your shopping cart is empty</h2>
            <p className="mt-2 text-sm text-[#3f4545]">Add premium ayurvedic products to start your wellness journey.</p>
            <Button asChild className="mt-6 bg-emerald-700 hover:bg-emerald-800 rounded-md px-6">
              <Link href="/products">
                Shop Products
                <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
            
            {/* Left side: Cart List */}
            <div className="flex flex-col gap-4">
              {/* Select-all bar */}
              <label className="flex items-center gap-3 rounded-md border border-border bg-white px-4 py-3 shadow-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="size-4 accent-emerald-700"
                />
                <span className="text-xs font-bold text-[#0f1111]">
                  Select all items ({selectedItems.length}/{cart.length} selected)
                </span>
              </label>

              <Stagger className="grid gap-4">
                {cart.map((item) => (
                  <StaggerItem key={item.productId}>
                    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-md border bg-white p-4 shadow-sm transition ${isSelected(item) ? "border-[#d5d9d9]" : "border-border opacity-60"}`}>

                      {/* Checkbox + Image & Title */}
                      <div className="flex items-center gap-4">
                        <input
                          type="checkbox"
                          checked={isSelected(item)}
                          onChange={() => toggleSelect(item.productId)}
                          className="size-4 shrink-0 accent-emerald-700"
                          aria-label={`Select ${item.name} for checkout`}
                        />
                        <Link
                          href={`/products/${item.slug}`}
                          onClick={() => handleViewDetails(item.productId, item.name)}
                          className="group flex items-center gap-4"
                          title="View details (removes this item from your cart)"
                        >
                          {item.imageMediaType === "VIDEO" && item.image ? (
                            // No autoplay: `#t=0.1` + preload="metadata" fetches
                            // just the header and one frame for this 64px
                            // thumbnail instead of streaming the whole clip.
                            <video
                              src={`${item.image}#t=0.1`}
                              muted
                              playsInline
                              preload="metadata"
                              aria-hidden="true"
                              className="size-16 rounded border border-[#d5d9d9] bg-[#f8fafc] object-contain"
                            />
                          ) : (
                            <div
                              className="size-16 rounded border border-[#d5d9d9] bg-[#f8fafc] bg-contain bg-no-repeat bg-center"
                              style={{ backgroundImage: `url('${item.image || "https://images.pexels.com/photos/4871365/pexels-photo-4871365.jpeg?auto=compress&cs=tinysrgb&w=150"}')` }}
                            />
                          )}
                          <div>
                            <h3 className="text-sm font-bold text-[#0f1111] group-hover:underline">
                              {item.name}
                            </h3>
                            <p className="mt-1 text-xs text-[#0f1111] font-extrabold">
                              Rs. {item.price.toLocaleString()}
                            </p>
                          </div>
                        </Link>
                      </div>

                      {/* Quantity & Action Controls */}
                      <div className="flex items-center justify-between w-full sm:w-auto gap-6 border-t border-[#d5d9d9] sm:border-t-0 pt-3 sm:pt-0">
                        <div className="flex items-center rounded-md border border-[#d5d9d9] p-0.5">
                          <button
                            onClick={() => updateQuantity(item.productId, -1)}
                            className="flex size-7 items-center justify-center rounded bg-[#f8fafc] text-[#0f1111] hover:bg-[#232f3e] hover:text-white transition"
                          >
                            <Minus className="size-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-[#0f1111]">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.productId, 1)}
                            className="flex size-7 items-center justify-center rounded bg-[#f8fafc] text-[#0f1111] hover:bg-[#232f3e] hover:text-white transition"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="text-sm font-extrabold text-[#0f1111] w-20 text-right">
                            Rs. {(item.price * item.quantity).toLocaleString()}
                          </span>
                          <button
                            onClick={() => removeItem(item.productId, item.name)}
                            className="text-[#565959] hover:text-rose-600 transition"
                            title="Remove item"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>

              <div className="mt-4">
                <Link href="/products" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white hover:underline transition">
                  <ArrowLeft className="size-4" />
                  Continue Shopping
                </Link>
              </div>
            </div>

            {/* Right side: Order Summary Card */}
            <FadeIn>
              <Tilt3D maxTilt={5} scale={1.01}>
              <div className="rounded-md border border-border bg-white p-5 shadow-sm flex flex-col gap-5 sm:p-6 lg:sticky lg:top-24">
                <AnimatedHeading
                  as="h2"
                  text="Order Summary"
                  className="text-lg font-bold text-[#0f1111] border-b border-[#d5d9d9] pb-3"
                  highlightWords={["Summary"]}
                  highlightClassName=""
                />

                <div className="space-y-3 text-xs font-medium text-[#3f4545]">
                  <div className="flex justify-between">
                    <span>Items (incl. GST)</span>
                    <span className="font-bold text-[#0f1111]">Rs. {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping Charges</span>
                    <span className="font-bold text-[#0f1111]">
                      {shipping === 0 ? (
                        <span className="text-[#0f1111] font-bold uppercase">Free</span>
                      ) : (
                        `Rs. ${shipping.toLocaleString()}`
                      )}
                    </span>
                  </div>
                </div>

                <div className="border-t border-[#d5d9d9] pt-4 flex justify-between font-extrabold text-[#0f1111]">
                  <span className="text-sm">Total Amount</span>
                  <span className="text-base text-[#0f1111]">Rs. {total.toLocaleString()}</span>
                </div>
                {tax > 0 && (
                  <p className="-mt-2 text-right text-[10px] font-medium text-[#565959]">
                    Includes GST of Rs. {tax.toLocaleString()}
                  </p>
                )}

                {shipping > 0 && (
                  <p className="text-[10px] font-medium text-[#0f1111] bg-[#f8fafc] border border-[#d5d9d9] p-2 rounded text-center">
                    Add <b>Rs. {(freeShipThreshold - subtotal).toLocaleString()}</b> more to qualify for <b>FREE SHIPPING</b>!
                  </p>
                )}

                {selectedItems.length === 0 ? (
                  <Button
                    disabled
                    variant="secondary"
                    className="h-12 ring-0 bg-[#FFD814] text-[#0F1111] rounded-md text-sm font-semibold mt-2 opacity-60"
                  >
                    Select items to checkout
                  </Button>
                ) : (
                  <Button asChild variant="secondary" className="h-12 ring-0 bg-[#FFD814] text-[#0F1111] hover:bg-[#F7CA00] rounded-md text-sm font-semibold mt-2">
                    <Link href="/checkout">
                      Proceed to Checkout ({selectedCount} {selectedCount === 1 ? "item" : "items"})
                      <ArrowRight className="size-4 ml-2" />
                    </Link>
                  </Button>
                )}
              </div>
              </Tilt3D>
            </FadeIn>

          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
