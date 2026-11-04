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

  // Tap targets follow Amazon's mobile CTA sizing — tall enough to hit with a
  // thumb, and never allowed to wrap or be clipped by a cramped card footer.
  // `compact` is `sm` on tablets and up, a notch tighter on phones — for cards
  // laid three across a phone (~105px each), where `sm` would not fit.
  const sizing =
    size === "compact"
      ? "gap-0.5 px-1.5 py-1.5 text-[10px] sm:gap-1 sm:px-3 sm:py-2 sm:text-[11px]"
      : size === "sm"
        ? "gap-1 px-3 py-2 text-[11px]"
        : "gap-1 px-3.5 py-2.5 text-xs";
  const chevron = size === "compact" ? "size-3 sm:size-3.5" : "size-3.5";

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
      // `justify-center` + `whitespace-nowrap` so callers can stretch this to
      // `w-full` on mobile and still get a centred, never-wrapping label.
      className={`relative z-20 inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#ffd814] font-bold text-[#0f1111] shadow-md transition-colors hover:bg-[#f7ca00] ${sizing} ${className}`}
    >
      Shop now
      <ChevronRight className={`${chevron} transition-transform group-hover:translate-x-0.5`} />
    </button>
  );
}
