import Link from "next/link";
import { Star, Sparkles } from "lucide-react";
import { ShopNowButton } from "@/components/ShopNowButton";
import { ProductMedia } from "@/components/ProductMedia";
import { formatMoney } from "@/lib/currency";
import { TAX_INCLUSIVE_LABEL } from "@/lib/pricing";

// Shared, Amazon-style product card used across the catalog and category grids.
//
// Two layouts, chosen with the `layout` prop:
//   "overlay" (default) — the photo fills the card and the title / rating /
//     price float on top of a dark gradient scrim. Used by the category grids,
//     related products and the featured carousel.
//   "stacked" — Amazon's catalog card: the photo sits on top and every piece of
//     text lives in a white block underneath, so nothing is ever drawn over the
//     product image. Used by the /products grid view and the home page's
//     "New Arrivals" strip.
//
// The rating is NEVER hardcoded — callers pass the aggregate of the product's
// real ProductReview rows (average + count) via `summarizeReviews` below.

const FALLBACK_IMG =
  "https://images.pexels.com/photos/4871365/pexels-photo-4871365.jpeg?auto=compress&cs=tinysrgb&w=600";

// reviews: [{ rating }] → { rating: <avg 0-5>, count }. Empty list → 0 / 0.
export function summarizeReviews(reviews = []) {
  const count = reviews.length;
  if (count === 0) return { rating: 0, count: 0 };
  const sum = reviews.reduce((total, r) => total + (r.rating || 0), 0);
  return { rating: sum / count, count };
}

// Reusable star bar: a muted 5-star base with a gold overlay clipped to the
// average. `size` is the lucide icon size class (default `size-4`). Shared by
// the catalog cards and the product detail buy-box.
export function RatingStars({ rating = 0, size = "size-4" }) {
  const stars = [0, 1, 2, 3, 4];
  const pct = (Math.max(0, Math.min(5, rating)) / 5) * 100;

  return (
    <span
      className="relative inline-flex"
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      <span className="flex text-[#d5d9d9]">
        {stars.map((i) => (
          <Star key={i} className={size} fill="currentColor" stroke="currentColor" />
        ))}
      </span>
      <span
        className="absolute inset-0 flex overflow-hidden text-[#f59e0b]"
        style={{ width: `${pct}%` }}
      >
        {stars.map((i) => (
          <Star key={i} className={`${size} shrink-0`} fill="currentColor" stroke="currentColor" />
        ))}
      </span>
    </span>
  );
}

export function ProductCard({
  product,
  categoryName,
  rating = 0,
  reviewCount = 0,
  // Card shape. Defaults to a square (1:1) tile so a single product upload fits
  // uncropped across every surface — grid, list thumbnail and carousel all share
  // this ratio. Callers can still override for a taller/shorter box if needed.
  // Under `layout="stacked"` this sizes the photo alone, not the whole card —
  // the text block below adds its own height.
  aspect = "aspect-square",
  layout = "overlay",
  // How a still fills the stacked layout's photo box. "cover" (the default)
  // fills the box edge to edge so there are no white/grey side bars.
  mediaFit = "cover",
  // Viewport widths the photo will occupy. The default assumes the usual row
  // density (two-up on phones, three-up on tablets, four-up on desktop); a
  // caller that renders the card wider than that — e.g. a carousel holding a
  // single product — must say so, or the optimizer picks a variant sized for a
  // card half the width and the photo lands soft.
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
}) {
  // Primary media, rendered by <ProductMedia> so stills go through the image
  // optimizer and clips stay unloaded until hover. The data layer already
  // prefers a still over a video here (see `pickCardMedia`), so a card only ever
  // gets a video for a product that has no photo at all.
  const primaryMedia = product.images?.[0] ?? {
    url: FALLBACK_IMG,
    mediaType: "IMAGE",
  };
  const price = Number(product.price);
  const mrp = product.mrp != null ? Number(product.mrp) : null;
  const hasDeal = mrp != null && mrp > price;
  const category = categoryName || product.category?.name;
  const offerLabel = product.offerLabel?.trim();
  const href = `/products/${product.slug}`;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const outOfStock = product.stock === 0;

  // ── Amazon-style stacked card: photo on top, all text on white underneath ──
  if (layout === "stacked") {
    return (
      // `h-full` + a flex column so every card in a grid row ends up the same
      // height with its CTA aligned, however long the titles are.
      <div
        data-media-hover-root
        className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      >
        {/* Stretched link — keeps the whole card clickable while leaving the
            "Shop now" CTA a real <button>. See the overlay layout below. */}
        <Link href={href} className="absolute inset-0 z-10" aria-label={product.name} />

        {/* Photo. Stills follow `mediaFit`; video is shot 9:16 and would
            letterbox, so it always fills the frame — the same rule the list row
            uses. */}
        <div className={`relative ${aspect} w-full shrink-0 overflow-hidden bg-[#f7fafa]`}>
          <ProductMedia
            media={primaryMedia}
            alt={product.name}
            // Stills follow the caller's `mediaFit`; a clip is shot 9:16 and
            // would letterbox, so it fills the frame regardless.
            fit={primaryMedia.mediaType === "VIDEO" ? "cover" : mediaFit}
            sizes={sizes}
            className="transition-transform duration-500 group-hover:scale-105"
          />
          {/* Badges float over the photo, top-left */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-start gap-1.5 p-2">
            {product.isFeatured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#ffffff]/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0f1111] shadow-sm backdrop-blur">
                <Sparkles className="size-3" />
                Best Seller
              </span>
            ) : null}
            {/* Admin-entered promo badge (e.g. "Up to 4% off"). Hidden when blank. */}
            {offerLabel ? (
              <span className="rounded-full bg-[#e11d48] px-2 py-0.5 text-[10px] font-extrabold text-[#ffffff] shadow-md">
                {offerLabel}
              </span>
            ) : null}
          </div>
        </div>

        {/* White text block — nothing here sits over the photo. Its vertical
            rhythm is deliberately tight: every line here is short, so the card's
            height was going into padding rather than content. */}
        <div className="flex flex-1 flex-col p-2 sm:p-2.5">
          {category ? (
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#565959]">
              {category}
            </p>
          ) : null}

          <h3 className="mt-0.5 line-clamp-2 text-sm font-bold leading-5 text-[#0f1111] group-hover:underline">
            {product.name}
          </h3>

          {/* Pack size — without it two sizes of the same item are two
              indistinguishable cards. */}
          {product.netQuantity ? (
            <p className="mt-1 text-[11px] font-semibold text-[#565959]">
              {product.netQuantity}
            </p>
          ) : null}

          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {reviewCount > 0 ? (
              <>
                <span className="text-xs font-bold text-slate-700">{rating.toFixed(1)}</span>
                <RatingStars rating={rating} size="size-3.5" />
                <span className="text-[11px] font-medium text-slate-500">
                  ({reviewCount.toLocaleString("en-AE")})
                </span>
              </>
            ) : (
              <>
                <RatingStars rating={0} size="size-3.5" />
                <span className="text-[11px] font-medium text-slate-500">No ratings yet</span>
              </>
            )}
          </div>

          {/* Price + CTA pinned to the bottom so they line up across the row. */}
          <div className="mt-auto pt-1.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-base font-extrabold text-[#0f1111] sm:text-lg">
                {formatMoney(price)}
              </span>
              {hasDeal ? (
                <span className="text-xs font-medium text-slate-500 line-through">
                  {formatMoney(mrp)}
                </span>
              ) : null}
            </div>

            {/* The price is final — say so on the card rather than leaving the
                shopper to discover it at checkout. */}
            <p className="mt-0.5 text-[10px] font-medium text-[#565959]">
              {TAX_INCLUSIVE_LABEL}
            </p>

            {outOfStock ? (
              <p className="mt-1 text-[11px] font-bold text-[#e11d48]">Out of stock</p>
            ) : lowStock ? (
              <p className="mt-1 text-[11px] font-bold text-[#e11d48]">
                Only {product.stock} left
              </p>
            ) : null}

            <ShopNowButton href={href} size="sm" className="mt-1.5 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    // The card is a plain container rather than one big <Link> so the "Shop now"
    // CTA can be a real <button> (a button nested in an <a> is invalid HTML).
    // Whole-card clicking is preserved by the stretched <Link> overlay below.
    <div
      data-media-hover-root
      className={`group relative block ${aspect} overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-[#f7fafa] to-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl`}
    >
      {/* Product media fills the whole card, mirroring the category card. A clip
          stays unloaded until hover; a still goes through the image optimizer. */}
      <ProductMedia
        media={primaryMedia}
        alt={product.name}
        fit="cover"
        sizes={sizes}
        className="transition-transform duration-500 group-hover:scale-[1.06]"
      />

      {/* Stretched link — keeps the entire card clickable (and middle-clickable
          / openable in a new tab) now that the card itself is no longer an <a>.
          Sits above the media but below the "Shop now" button's z-10. */}
      <Link
        href={href}
        className="absolute inset-0 z-10"
        aria-label={product.name}
      />

      {/* Top badges floating over the image */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <div className="flex flex-col items-start gap-1.5">
          {product.isFeatured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ffffff]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0f1111] shadow-sm backdrop-blur">
              <Sparkles className="size-3" />
              Best Seller
            </span>
          ) : null}
          {/* Admin-entered promo badge (e.g. "Up to 4% off"). Hidden when blank. */}
          {offerLabel ? (
            <span className="rounded-full bg-[#e11d48] px-2.5 py-1 text-[10px] font-extrabold text-[#ffffff] shadow-md">
              {offerLabel}
            </span>
          ) : null}
        </div>
      </div>

      {/* Bottom gradient scrim with the overlaid title / rating / price.
          Padding tightens on mobile so the footer keeps every line — including
          the CTA — inside the card on a narrow two-column grid. */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0f1111]/95 via-[#0f1111]/65 to-transparent p-3 pt-12 sm:p-4 sm:pt-14">
        {category ? (
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#ffffff]/70">
            {category}
          </p>
        ) : null}

        <h3 className="mt-0.5 line-clamp-2 text-sm font-bold leading-5 text-[#ffffff] group-hover:underline">
          {product.name}
        </h3>

        {/* Real customer rating */}
        <div className="mt-1.5 flex items-center gap-1.5">
          {reviewCount > 0 ? (
            <>
              <span className="text-xs font-bold text-[#ffffff]">{rating.toFixed(1)}</span>
              <RatingStars rating={rating} />
              <span className="text-[11px] font-medium text-[#ffffff]/70">
                ({reviewCount.toLocaleString("en-AE")})
              </span>
            </>
          ) : (
            <>
              <RatingStars rating={0} />
              <span className="text-[11px] font-medium text-[#ffffff]/60">No ratings yet</span>
            </>
          )}
        </div>

        {/* Price + CTA. On mobile the CTA drops onto its own full-width line
            (Amazon's mobile pattern) — side-by-side it would be squeezed by a
            long price and its trailing chevron clipped by the card edge. */}
        <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-base font-extrabold text-[#ffffff] sm:text-lg">
                {formatMoney(price)}
              </span>
              {hasDeal ? (
                <span className="text-xs font-medium text-[#ffffff]/55 line-through">
                  {formatMoney(mrp)}
                </span>
              ) : null}
            </div>
            {/* The price is final — say so on the card rather than leaving the
                shopper to discover it at checkout. */}
            <p className="text-[10px] font-medium text-[#ffffff]/70">
              {TAX_INCLUSIVE_LABEL}
            </p>
          </div>
          <ShopNowButton href={href} size="sm" className="w-full sm:w-auto" />
        </div>

        {outOfStock ? (
          <p className="mt-2 text-[11px] font-bold text-[#fda4af]">Out of stock</p>
        ) : lowStock ? (
          <p className="mt-2 text-[11px] font-bold text-[#fda4af]">
            Only {product.stock} left in stock
          </p>
        ) : null}
      </div>
    </div>
  );
}

// Amazon-style horizontal list row: the photo sits on the left and the title /
// rating / description / price stack on the right. Used by the catalog list
// view. Shares the same rating + review aggregation as `ProductCard`.
//
// Colors follow the page's override-safe convention — Amazon ink `#0f1111` for
// headings/strong and `#565959` for muted body copy; we never use
// `text-white/xx` here since the row sits on a white card.
export function ProductListRow({ product, categoryName, rating = 0, reviewCount = 0 }) {
  const primaryMedia = product.images?.[0] ?? {
    url: FALLBACK_IMG,
    mediaType: "IMAGE",
  };
  const price = Number(product.price);
  const mrp = product.mrp != null ? Number(product.mrp) : null;
  const hasDeal = mrp != null && mrp > price;
  const category = categoryName || product.category?.name;
  const offerLabel = product.offerLabel?.trim();
  const href = `/products/${product.slug}`;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const outOfStock = product.stock === 0;
  // Only the admin-authored short description belongs on a list row — the full
  // description is a multi-paragraph body meant for the product page, and
  // falling back to it made rows wildly uneven in height.
  const blurb = product.shortDescription?.trim() || "";

  return (
    // Container + stretched link rather than one big <Link>, so the "Shop now"
    // CTA can be a real <button>. See ProductCard above.
    <div
      data-media-hover-root
      className="group relative flex gap-3 rounded-xl border border-border bg-white p-3 shadow-sm transition-shadow duration-300 hover:shadow-lg sm:gap-5 sm:p-4"
    >
      <Link
        href={href}
        className="absolute inset-0 z-10 rounded-xl"
        aria-label={product.name}
      />

      {/* Product media on the left. The tile is 4:5 to match the shape product
          photos are uploaded in (1122x1402), so a still fills it edge to edge
          with no letterboxing, and `bg-contain` guarantees an odd-shaped upload
          is still shown whole rather than cropped.
          Video is the exception: clips are shot 9:16 (1080x1920), which would
          leave a blank band down both sides if contained, so it is cropped to
          fill the tile the way any video thumbnail is. */}
      <div className="relative aspect-[4/5] w-40 shrink-0 self-start overflow-hidden rounded-lg bg-[#f7fafa] sm:w-44">
        <ProductMedia
          media={primaryMedia}
          alt={product.name}
          fit="cover"
          // Fixed-width tile (160px, 176px from sm up) — no need to ever fetch
          // more than a 2x variant of that.
          sizes="176px"
          className="transition-transform duration-500 group-hover:scale-105"
        />
        {/* Badges floating over the photo */}
        <div className="absolute inset-x-0 top-0 flex flex-col items-start gap-1.5 p-2">
          {product.isFeatured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ffffff]/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#0f1111] shadow-sm backdrop-blur">
              <Sparkles className="size-2.5" />
              Best Seller
            </span>
          ) : null}
          {offerLabel ? (
            <span className="rounded-full bg-[#e11d48] px-2 py-0.5 text-[9px] font-extrabold text-[#ffffff] shadow-md">
              {offerLabel}
            </span>
          ) : null}
        </div>
      </div>

      {/* Details on the right */}
      <div className="flex min-w-0 flex-1 flex-col">
        {category ? (
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#565959]">
            {category}
          </p>
        ) : null}

        {/* Three lines on mobile: the 4:5 photo makes the row taller than the
            text stack, and the narrower column needs the extra line anyway. */}
        <h3 className="mt-0.5 line-clamp-3 text-sm font-bold leading-5 text-[#0f1111] group-hover:underline sm:line-clamp-2 sm:text-base">
          {product.name}
        </h3>

        {/* Real customer rating. Stars shrink a notch on mobile — the wider
            photo leaves a narrow text column, and five size-4 stars plus the
            score and count would otherwise run past its edge. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {reviewCount > 0 ? (
            <>
              <span className="text-xs font-bold text-slate-700">{rating.toFixed(1)}</span>
              <RatingStars rating={rating} size="size-3.5 sm:size-4" />
              <span className="text-[11px] font-medium text-slate-500">
                ({reviewCount.toLocaleString("en-AE")})
              </span>
            </>
          ) : (
            <>
              <RatingStars rating={0} size="size-3.5 sm:size-4" />
              <span className="text-[11px] font-medium text-slate-500">No ratings yet</span>
            </>
          )}
        </div>

        {/* Short description — hidden on the smallest screens to keep rows
            compact. The show/hide lives on a wrapper because `line-clamp-2`
            itself sets `display: -webkit-box`; putting both on one element
            makes the two `display` rules fight, so the copy renders unclamped
            (or leaks onto mobile) depending on stylesheet order. */}
        {blurb ? (
          <div className="mt-1.5 hidden sm:block">
            <p className="line-clamp-2 text-xs text-slate-500">{blurb}</p>
          </div>
        ) : null}

        {/* Price + CTA pinned to the bottom of the row */}
        <div className="mt-auto pt-2.5">
          {/* Wraps rather than overflows if a long price sits next to its MRP. */}
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-base font-extrabold text-[#0f1111] sm:text-lg">
              {formatMoney(price)}
            </span>
            {hasDeal ? (
              <span className="text-xs font-medium text-slate-500 line-through">
                {formatMoney(mrp)}
              </span>
            ) : null}
          </div>

          {/* The price is final — say so on the row rather than leaving the
              shopper to discover it at checkout. */}
          <p className="mt-0.5 text-[10px] font-medium text-[#565959]">
            {TAX_INCLUSIVE_LABEL}
          </p>

          {/* Stock line then CTA. On mobile the right-hand column is narrow, so
              the CTA takes its own full-width line rather than competing with
              the stock label and getting its chevron clipped. */}
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {outOfStock ? (
              <span className="text-[11px] font-bold text-[#e11d48]">Out of stock</span>
            ) : lowStock ? (
              <span className="text-[11px] font-bold text-[#e11d48]">
                Only {product.stock} left
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-slate-500">In stock</span>
            )}
            <ShopNowButton href={href} size="sm" className="w-full sm:w-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
