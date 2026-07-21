"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";

export function CartBadge() {
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    function computeCartItemsCount() {
      try {
        const cart = JSON.parse(localStorage.getItem("ayursanthi_cart") || "[]");
        const total = cart.reduce((acc, item) => acc + item.quantity, 0);
        setItemCount(total);
      } catch (err) {
        setItemCount(0);
      }
    }

    computeCartItemsCount();
    window.addEventListener("cartUpdate", computeCartItemsCount);
    return () => {
      window.removeEventListener("cartUpdate", computeCartItemsCount);
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
