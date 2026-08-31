"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { FileText, ImageOff, Leaf, Play, ShieldCheck, Box } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ImageFill } from "@/components/ProductMedia";
import { RatingStars } from "@/components/ProductCard";
import { ProductReviews } from "@/components/ProductReviews";
import { DeliveryInfo } from "@/components/DeliveryInfo";
import { ProductDescription, AboutThisItem } from "@/components/ProductDescription";
import { formatMoney } from "@/lib/currency";
import { TAX_INCLUSIVE_LABEL } from "@/lib/pricing";

// ─────────────────────────────────────────────────────────────────────────────
// "View full details" — the read-only replacement for the old Download-PDF
// button. Everything the product page shows (media, price, ingredients, specs,
// the A+ description and every review) is re-laid-out inside one scrollable
// modal, so a shopper can take the whole sheet in without leaving the buy box
// or scrolling past the fold.
//
// There is deliberately NO file to keep: nothing here is generated, streamed or
// linked as a download. The media guards below (no drag, no context menu, no
// native download control on the player) close the obvious save routes — they
// are a deterrent, not DRM, since the media URLs themselves are still public.
//
// Two triggers open the same modal — the tile at the end of the gallery's
// thumbnail strip (ProductGallery) and the one in the sticky action bar
// (ProductActions) — and they sit in opposite columns of the page, so the open
// state lives in a context provider wrapping both rather than in either button.
// ─────────────────────────────────────────────────────────────────────────────

const DetailsContext = createContext(null);

/**
 * Wraps the part of the product page that owns the triggers. Renders a fragment
 * (no DOM node) — it sits directly inside the page's two-column grid, where an
 * extra wrapper element would break the layout.
 *
 * `details` must be plain serializable data (see the product page): Decimals
 * already converted to numbers and dates to ISO strings.
 */
export function ProductDetailsProvider({ details, children }) {
  const [open, setOpen] = useState(false);

  const value = useMemo(() => ({ open: () => setOpen(true) }), []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <DetailsContext.Provider value={value}>
      {children}
      {open && details ? <FullDetailsModal details={details} onClose={close} /> : null}
    </DetailsContext.Provider>
  );
}

// The three places the trigger appears, each shaped for its neighbours:
//
//   tile    — last box in the gallery's thumbnail strip, so it lines up with
//             the media squares it follows (matching h-16 / sm:h-20).
//   compact — the sticky action bar, label hidden on the smallest screens so
//             Add to Cart / Buy Now keep their room.
//   inline  — a plain standalone button, for any caller that wants one.
const VARIANTS = {
  tile:
    "flex h-16 shrink-0 items-center gap-2 rounded border border-emerald-200 bg-white px-3 text-xs font-bold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-50 sm:h-20 sm:px-4 sm:text-sm",
  compact:
    "flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-50 sm:px-4",
  inline:
    "mt-4 inline-flex items-center justify-center gap-2 rounded-md border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-50",
};

/**
 * The trigger. Returns null outside the provider, so a page that never wired
 * the modal up simply shows no button rather than crashing.
 */
export function ViewFullDetailsButton({ variant = "inline", tabIndex }) {
  const ctx = useContext(DetailsContext);
  if (!ctx) return null;

  const compact = variant === "compact";

  return (
    <button
      type="button"
      onClick={ctx.open}
      tabIndex={tabIndex}
      aria-haspopup="dialog"
      aria-label={compact ? "View full product details" : undefined}
      className={VARIANTS[variant] || VARIANTS.inline}
    >
      <FileText className="size-4 shrink-0" />
      {compact ? (
        <span className="hidden sm:inline">Details</span>
      ) : variant === "tile" ? (
        // Two short lines rather than one long one, so the tile stays close to
        // the width of the thumbnails beside it.
        <span className="text-left leading-tight">
          View full
          <br />
          details
        </span>
      ) : (
        "View full details"
      )}
    </button>
  );
}

// ── Media ───────────────────────────────────────────────────────────────────

// Same trick the page gallery uses: asking for a frame a fraction of a second
// in makes the browser decode a poster instead of painting a black box.
const POSTER_FRAGMENT = "#t=0.1";

function MediaPlaceholder({ compact = false }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[#f7fafa] text-[#565959]">
      <ImageOff className={compact ? "size-4" : "size-8"} />
      {compact ? null : <span className="text-[11px] font-semibold">Image unavailable</span>}
    </div>
  );
}

/**
 * Main viewer + thumbnail strip, mirroring the page gallery — except videos
 * play *in place* here rather than in a lightbox. That is not a shortcut: the
 * modal card carries a transform (its open animation), which makes it the
 * containing block for any `position: fixed` descendant, so a nested
 * fullscreen lightbox would be trapped inside the card instead of covering
 * the viewport.
 *
 * A clip still costs nothing until it is asked for: `preload="metadata"` pulls
 * only the header, and the file itself is fetched when the shopper hits play.
 */
function DetailsMedia({ media, productName }) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState(() => new Set());

  const markFailed = (index) =>
    setFailed((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));

  if (media.length === 0) return null;

  const current = media[Math.min(active, media.length - 1)];
  const currentIsVideo = current.mediaType === "VIDEO";

  return (
    <div
      // Closes the two obvious save routes for every image and clip below.
      // Both events bubble, so guarding the container covers the whole gallery.
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      className="flex flex-col gap-3"
    >
      <div
        className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-border ${
          currentIsVideo ? "bg-black" : "bg-white"
        }`}
      >
        {currentIsVideo ? (
          <video
            // Keyed by URL so switching thumbnails swaps the source instead of
            // leaving the previous clip loaded (and playing) in the element.
            key={current.url}
            src={current.url}
            controls
            playsInline
            preload="metadata"
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            className="size-full object-contain"
          />
        ) : failed.has(active) ? (
          <MediaPlaceholder />
        ) : (
          <ImageFill
            src={current.url}
            alt={current.altText || productName}
            fit="contain"
            // The modal caps this column at 480px from lg up, and the media
            // fills the phone width below that.
            sizes="(max-width: 640px) 92vw, 480px"
            onError={() => markFailed(active)}
          />
        )}
      </div>

      {media.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {media.map((item, index) => {
            const isVideo = item.mediaType === "VIDEO";
            const isBroken = !isVideo && failed.has(index);

            return (
              <button
                key={index}
                type="button"
                onClick={() => setActive(index)}
                aria-label={`View ${isVideo ? "video" : "image"} ${index + 1}`}
                aria-current={index === active}
                className={`relative size-14 shrink-0 overflow-hidden rounded border transition sm:size-16 ${
                  isVideo ? "bg-black" : "bg-white"
                } ${
                  index === active
                    ? "border-emerald-600 ring-2 ring-emerald-600/30"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {isBroken ? (
                  <MediaPlaceholder compact />
                ) : isVideo ? (
                  <>
                    <video
                      src={`${item.url}${POSTER_FRAGMENT}`}
                      muted
                      playsInline
                      preload="metadata"
                      className="size-full object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play className="size-4 fill-white text-white" />
                    </span>
                  </>
                ) : (
                  <ImageFill
                    src={item.url}
                    alt={item.altText || `${productName} ${index + 1}`}
                    sizes="64px"
                    quality={50}
                    onError={() => markFailed(index)}
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────────

// A titled band, matching the rules-not-cards rhythm of the product page. The
// second word is emerald, the way AnimatedHeading highlights it on the page.
function Section({ title, highlight, children }) {
  return (
    <section className="border-t border-border pt-8">
      <h3 className="text-lg font-bold text-[#0f1111] sm:text-xl">
        {title}
        {highlight ? <span className="text-emerald-800"> {highlight}</span> : null}
      </h3>
      {children}
    </section>
  );
}

function FullDetailsModal({ details, onClose }) {
  const {
    name,
    categoryName,
    netQuantity,
    sku,
    price,
    mrp,
    offerLabel,
    shortDescription,
    description,
    ingredients = [],
    attributes = [],
    reviews = [],
    media = [],
    avgRating = 0,
    reviewCount = 0,
  } = details;

  // Same rule as the buy box: prefer the admin's badge text, otherwise compute
  // the saving from MRP.
  const badge = offerLabel?.trim()
    ? offerLabel.trim()
    : mrp
      ? `${Math.round(((mrp - price) / mrp) * 100)}% OFF`
      : null;

  return (
    <Modal
      title={name}
      onClose={onClose}
      widthClass="max-w-sm sm:max-w-3xl lg:max-w-5xl"
      bodyClassName="p-4 sm:p-6"
    >
      {/* Top band — media beside the key facts, the way the page itself opens. */}
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="mx-auto w-full max-w-[480px] lg:mx-0">
          <DetailsMedia media={media} productName={name} />
        </div>

        <div className="min-w-0">
          {categoryName ? (
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
              {categoryName}
            </span>
          ) : null}

          <h3 className="mt-3 text-xl font-bold tracking-tight text-[#0f1111] sm:text-2xl">
            {name}
          </h3>

          <div className="mt-3 flex items-center gap-2">
            {reviewCount > 0 ? (
              <span className="text-sm font-bold text-[#0f1111]">{avgRating.toFixed(1)}</span>
            ) : null}
            <RatingStars rating={avgRating} />
            <span className="text-xs font-medium text-[#565959]">
              {reviewCount > 0
                ? `${reviewCount.toLocaleString("en-AE")} rating${reviewCount > 1 ? "s" : ""}`
                : "No ratings yet"}
            </span>
          </div>

          {netQuantity ? (
            <p className="mt-2 text-sm font-semibold text-[#0f1111]">
              Net Quantity: <span className="font-bold">{netQuantity}</span>
            </p>
          ) : null}
          {sku ? (
            <p className="mt-2 text-xs font-medium text-[#565959]">
              SKU: <span className="font-mono">{sku}</span>
            </p>
          ) : null}

          <div className="mt-5 rounded-md border border-emerald-100 bg-white p-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl font-extrabold text-emerald-800">
                {formatMoney(price)}
              </span>
              {mrp ? (
                <span className="text-sm text-[#565959] line-through">{formatMoney(mrp)}</span>
              ) : null}
              {badge ? (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800">
                  {badge}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs font-medium text-[#565959]">{TAX_INCLUSIVE_LABEL}</p>
          </div>

          {shortDescription ? (
            <p className="mt-6 text-sm leading-6 text-[#3f4545]">{shortDescription}</p>
          ) : null}

          <AboutThisItem body={description} />

          <DeliveryInfo />

          <div className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <Leaf className="size-4 text-[#0f1111]" />
              <span className="text-xs font-bold text-[#0f1111]">100% Natural</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-[#0f1111]" />
              <span className="text-xs font-bold text-[#0f1111]">Lab Tested</span>
            </div>
            <div className="flex items-center gap-2">
              <Box className="size-4 text-[#0f1111]" />
              <span className="text-xs font-bold text-[#0f1111]">Secure Dispatch</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 space-y-10">
        {ingredients.length > 0 ? (
          <Section title="Key" highlight="Ingredients">
            <ul className="mt-5 flex flex-wrap gap-2">
              {ingredients.map((ingredient) => (
                <li
                  key={ingredient}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-900"
                >
                  <Leaf className="size-3.5 shrink-0" />
                  {ingredient}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {attributes.length > 0 ? (
          <Section title="Product" highlight="Specifications">
            <div className="mt-5 overflow-hidden rounded-md border border-border bg-white">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100">
                  {attributes.map((attr) => (
                    <tr key={attr.id} className="align-top">
                      <th className="w-2/5 bg-slate-50 px-4 py-3 font-semibold text-slate-600 sm:w-1/3">
                        {attr.label}
                      </th>
                      <td className="px-4 py-3 text-slate-800">{attr.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        ) : null}

        <Section title="Product" highlight="Description">
          {/* Never folded here — the reader is already the "show me everything"
              surface, so a second "See more" would only be in the way. */}
          <ProductDescription body={description} collapsible={false} />
        </Section>

        <Section title="Customer" highlight="Reviews">
          <ProductReviews reviews={reviews} />
        </Section>
      </div>
    </Modal>
  );
}
