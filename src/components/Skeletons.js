// Lightweight, dependency-free loading placeholders used by the route-level
// `loading.js` files. The App Router renders a route's loading.js the instant a
// <Link> is clicked — while the server renders the real page — so navigation
// feels instant instead of the old page appearing frozen.
//
// These are plain server components (no "use client", no data, no effects) so
// they add zero client work. Placeholder colours are applied with INLINE styles
// on purpose: globals.css remaps colours by class-name match, which can turn a
// utility-coloured block invisible — inline styles bypass that entirely. Only
// `animate-pulse` (an opacity animation, not a colour) comes from a class.

const PLACEHOLDER = "#e2e8f0"; // slate-200
const PLACEHOLDER_SOFT = "#eef2f6"; // slate-100-ish, for large image areas

// A single shimmering placeholder block. Pass sizing/rounding via className.
export function Sk({ className = "", style }) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{ backgroundColor: PLACEHOLDER, ...style }}
    />
  );
}

// Minimal stand-in for SiteHeader. The real header lives inside each page (not a
// shared layout), so a full-page skeleton would otherwise flash a blank strip at
// the top. This keeps the top of the viewport stable during the load.
export function HeaderSkeleton() {
  return (
    <div className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Sk className="h-10 w-28" />
        <div className="hidden gap-6 lg:flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Sk key={i} className="h-4 w-16" />
          ))}
        </div>
        <div className="flex gap-3">
          <Sk className="h-9 w-9 rounded-full" />
          <Sk className="h-9 w-9 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// One catalog card placeholder — matches the rough shape of a real ProductCard
// (square media on top, a few text lines below) so the grid doesn't jump when
// real cards arrive.
export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-white">
      <Sk
        className="aspect-square w-full rounded-none"
        style={{ backgroundColor: PLACEHOLDER_SOFT }}
      />
      <div className="space-y-2 p-3">
        <Sk className="h-3 w-1/3" />
        <Sk className="h-4 w-4/5" />
        <Sk className="h-4 w-2/5" />
      </div>
    </div>
  );
}
