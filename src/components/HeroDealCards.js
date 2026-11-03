import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";

// ─────────────────────────────────────────────────────────────────────────────
// HeroDealCards — the new-arrivals strip below the hero (no heading), showing
// the four newest products as stacked cards (the same ProductCard the catalog
// grid uses). When more than the four shown products exist, a "Show more" button
// links to the full catalog (never expands inline).
//
// Two shapes:
//   laptop — four across, stacked under the hero with normal spacing. (It used
//     to overlap the hero's lower edge, but without a heading in the overlap the
//     cards themselves covered the video.)
//   phone/tablet — two across, also stacked under the hero, and the "Show more"
//     button drops onto its own full-width line below the grid.
// ─────────────────────────────────────────────────────────────────────────────
export function HeroDealCards({ products = [], total = 0 }) {
  const cards = products.slice(0, 4);
  if (cards.length === 0) return null;

  const hasMore = total > cards.length;

  // A store showing exactly one new arrival widens that card, matching the CMS
  // product carousels: at the row width (half a phone, a quarter of a laptop) a
  // lone centred card reads as a mistake. Phone/tablet take the DEAL_GRID card's
  // widths, laptop goes a step wider than it. No gap to subtract from the basis
  // here — there's no neighbour. Two or more cards keep the ladder below.
  const solo = cards.length === 1;

  return (
    <section className="relative z-10 block">
      <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-5">
          {/* A wrapping flex row rather than a grid, purely so a row that isn't
              full is centred instead of left-hung — a store with one or two
              products used to strand a lone card against the left margin. The
              basis ladder reproduces the old grid exactly (two columns, four
              from lg; each card gives up its share of the gap), so a full row of
              four is pixel-identical to before. */}
          <div className="flex flex-1 flex-wrap justify-center gap-3 sm:gap-4 lg:gap-5">
            {cards.map((product) => (
              <div
                key={product.id}
                className={
                  solo
                    ? "basis-[80%] sm:basis-[45%] lg:basis-[33.333%]"
                    : "basis-[calc(50%-0.375rem)] sm:basis-[calc(50%-0.5rem)] lg:basis-[calc(25%-0.9375rem)]"
                }
              >
                <ProductCard
                  product={product}
                  categoryName={product.categoryName}
                  rating={product.rating}
                  reviewCount={product.reviewCount}
                  // Stacked, like the /products grid: the photo gets the top of
                  // the card to itself and the text sits on white underneath.
                  // The overlay layout drew the title/price over the lower half
                  // of the photo, which hid the product itself.
                  layout="stacked"
                  // Square rather than the 4:5 stills are uploaded in, matching
                  // the CMS carousels: it takes a fifth off the card's height.
                  aspect="aspect-square"
                  // …and the photo fills that square instead of being fitted
                  // inside it, so there are no blank bands down the sides. A 4:5
                  // upload gives up 10% off the top and 10% off the bottom —
                  // the margin around a centred product, not the product. Don't
                  // widen `aspect` past square without revisiting this; the crop
                  // grows fast from here.
                  mediaFit="cover"
                  // Must track the basis ladder above — the default assumes the
                  // multi-card row and would fetch a photo sized for a card half
                  // the width the solo card actually paints at.
                  sizes={
                    solo
                      ? "(max-width: 640px) 80vw, (max-width: 1024px) 45vw, 33vw"
                      : undefined
                  }
                />
              </div>
            ))}
          </div>

          {hasMore ? (
            <Link
              href="/products"
              className="inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-[#232f3e] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#131921]"
            >
              Show more
              <ChevronRight className="size-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
