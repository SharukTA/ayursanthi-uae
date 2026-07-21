"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

// The shared "Shop now" call-to-action. A real <button> element, used for every
// Shop now CTA across the catalog so they stay identical.
//
// Why a button that router.push()es instead of a <Link>: these CTAs sit inside
// cards whose whole surface is already a link (a stretched <Link> overlay). An
// <a> nested inside another <a> is invalid HTML and React warns on hydration, so
// the card's link stays the only anchor and this control is a button layered
// above it. `stopPropagation` keeps a click here from also triggering the
// underlying card link.
//
// `size="sm"` matches the compact product-card footer; the default suits the
// larger promo/deal tiles.
export function ShopNowButton({ href, size = "md", className = "" }) {
  const router = useRouter();

  const sizing =
    size === "sm"
      ? "gap-1 px-3 py-1.5 text-[11px]"
      : "gap-1 px-3.5 py-2 text-xs";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        router.push(href);
      }}
      // z-20 keeps the button above the card's stretched link overlay (z-10), so
      // clicks land here rather than on the card link underneath.
      className={`relative z-20 inline-flex shrink-0 items-center rounded-full bg-[#ffd814] font-bold text-[#0f1111] shadow-md transition-colors hover:bg-[#f7ca00] ${sizing} ${className}`}
    >
      Shop now
      <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
