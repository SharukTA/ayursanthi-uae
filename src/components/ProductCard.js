import Link from "next/link";
import { Star, Sparkles } from "lucide-react";
import { ShopNowButton } from "@/components/ShopNowButton";

// Shared, Amazon-style product card used across the catalog and category grids.
//
// Layout: the product photo fills the card as a fully-contained background, and
// the title / rating / price / offer badges float on top — a dark gradient scrim
// at the bottom keeps the overlaid text readable over any image.
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
  aspect = "aspect-square",
}) {
  // Primary media: an image is painted as a background, but a video (when the
  // admin ordered one first) must render in a real <video> element — a video
  // URL silently fails as a CSS background-image.
  const primaryMedia = product.images?.[0];
  const isVideo = primaryMedia?.mediaType === "VIDEO";
  const imageUrl = primaryMedia?.url || FALLBACK_IMG;
  const price = Number(product.price);
  const mrp = product.mrp != null ? Number(product.mrp) : null;
  const hasDeal = mrp != null && mrp > price;
  const category = categoryName || product.category?.name;
  const offerLabel = product.offerLabel?.trim();
  const href = `/products/${product.slug}`;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const outOfStock = product.stock === 0;

  return (
    // The card is a plain container rather than one big <Link> so the "Shop now"
    // CTA can be a real <button> (a button nested in an <a> is invalid HTML).
    // Whole-card clicking is preserved by the stretched <Link> overlay below.
    <div
      className={`group relative block ${aspect} overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-[#f7fafa] to-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl`}
    >
      {/* Product media fills the whole card, mirroring the category card. A
          video plays muted/looped inline; an image is painted as a background. */}
      {isVideo ? (
        <video
          src={imageUrl}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
        />
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.06]"
          style={{ backgroundImage: `url('${imageUrl}')` }}
        />
      )}

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

      {/* Bottom gradient scrim with the overlaid title / rating / price */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0f1111]/95 via-[#0f1111]/65 to-transparent p-4 pt-14">
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
                ({reviewCount.toLocaleString("en-IN")})
              </span>
            </>
          ) : (
            <>
              <RatingStars rating={0} />
              <span className="text-[11px] font-medium text-[#ffffff]/60">No ratings yet</span>
            </>
          )}
        </div>

        {/* Price + CTA */}
        <div className="mt-2.5 flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-extrabold text-[#ffffff]">
              Rs. {price.toLocaleString("en-IN")}
            </span>
            {hasDeal ? (
              <span className="text-xs font-medium text-[#ffffff]/55 line-through">
                Rs. {mrp.toLocaleString("en-IN")}
              </span>
            ) : null}
          </div>
          <ShopNowButton href={href} size="sm" />
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
  const primaryMedia = product.images?.[0];
  const isVideo = primaryMedia?.mediaType === "VIDEO";
  const imageUrl = primaryMedia?.url || FALLBACK_IMG;
  const price = Number(product.price);
  const mrp = product.mrp != null ? Number(product.mrp) : null;
  const hasDeal = mrp != null && mrp > price;
  const category = categoryName || product.category?.name;
  const offerLabel = product.offerLabel?.trim();
  const href = `/products/${product.slug}`;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const outOfStock = product.stock === 0;
  const blurb = product.shortDescription?.trim() || product.description?.trim() || "";

  return (
    // Container + stretched link rather than one big <Link>, so the "Shop now"
    // CTA can be a real <button>. See ProductCard above.
    <div className="group relative flex gap-3 rounded-xl border border-border bg-white p-3 shadow-sm transition-shadow duration-300 hover:shadow-lg sm:gap-5 sm:p-4">
      <Link
        href={href}
        className="absolute inset-0 z-10 rounded-xl"
        aria-label={product.name}
      />

      {/* Product photo on the left */}
      <div className="relative w-28 shrink-0 overflow-hidden rounded-lg bg-[#f7fafa] sm:w-44">
        {isVideo ? (
          <video
            src={imageUrl}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="aspect-square bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url('${imageUrl}')` }}
          />
        )}
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

        <h3 className="mt-0.5 line-clamp-2 text-sm font-bold leading-5 text-[#0f1111] group-hover:underline sm:text-base">
          {product.name}
        </h3>

        {/* Real customer rating */}
        <div className="mt-1.5 flex items-center gap-1.5">
          {reviewCount > 0 ? (
            <>
              <span className="text-xs font-bold text-slate-700">{rating.toFixed(1)}</span>
              <RatingStars rating={rating} />
              <span className="text-[11px] font-medium text-slate-500">
                ({reviewCount.toLocaleString("en-IN")})
              </span>
            </>
          ) : (
            <>
              <RatingStars rating={0} />
              <span className="text-[11px] font-medium text-slate-500">No ratings yet</span>
            </>
          )}
        </div>

        {/* Short description — hidden on the smallest screens to keep rows compact */}
        {blurb ? (
          <p className="mt-1.5 hidden line-clamp-2 text-xs text-slate-500 sm:block">{blurb}</p>
        ) : null}

        {/* Price + CTA pinned to the bottom of the row */}
        <div className="mt-auto pt-2.5">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-extrabold text-[#0f1111]">
              Rs. {price.toLocaleString("en-IN")}
            </span>
            {hasDeal ? (
              <span className="text-xs font-medium text-slate-500 line-through">
                Rs. {mrp.toLocaleString("en-IN")}
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            {outOfStock ? (
              <span className="text-[11px] font-bold text-[#e11d48]">Out of stock</span>
            ) : lowStock ? (
              <span className="text-[11px] font-bold text-[#e11d48]">
                Only {product.stock} left
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-slate-500">In stock</span>
            )}
            <ShopNowButton href={href} size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
