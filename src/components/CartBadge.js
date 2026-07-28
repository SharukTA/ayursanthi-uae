"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getCartCount } from "@/lib/cart-client";

export function CartBadge() {
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    // The badge lives in the header on every page, so it is almost always the
    // first thing to ask for the cart after a sign-in — which makes it the
    // component that triggers the browser-cart merge (see lib/cart-client.js).
    let active = true;

    async function refresh() {
      try {
        const count = await getCartCount();
        if (active) setItemCount(count);
      } catch {
        if (active) setItemCount(0);
      }
    }

    refresh();
    window.addEventListener("cartUpdate", refresh);
    // Signing in or out swaps which cart is in play — the count has to follow.
    window.addEventListener("authUpdate", refresh);

    return () => {
      active = false;
      window.removeEventListener("cartUpdate", refresh);
      window.removeEventListener("authUpdate", refresh);
    };
  }, []);

  return (
    <Link
      href="/cart"
      className="relative flex size-10 items-center justify-center rounded border border-white/40 text-white hover:border-white hover:bg-[#ffffff1a] transition"
      title="View Shopping Cart"
    >
      <ShoppingCart className="size-4.5" />
      {itemCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-white text-[9px] font-black text-[#0f1111] shadow-sm">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
