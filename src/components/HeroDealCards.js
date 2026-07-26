import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";

// ─────────────────────────────────────────────────────────────────────────────
// HeroDealCards — the "Fresh in / New Arrivals" strip below the hero, showing
// the four newest products as stacked cards (the same ProductCard the catalog
// grid uses). When more than the four shown products exist, a "Show more" button
// links to the full catalog (never expands inline).
//
// Two shapes:
//   laptop — four across, and a negative top margin pulls the row up so it
//     floats over the hero's lower edge, Amazon-deals-row style.
//   phone/tablet — two across, stacked under the hero with normal spacing (the
//     hero is short here, so overlapping it would cover the video), and the
//     "Show more" button drops onto its own full-width line below the grid.
// ─────────────────────────────────────────────────────────────────────────────
export function HeroDealCards({ products = [], total = 0 }) {
  const cards = products.slice(0, 4);
  if (cards.length === 0) return null;

  const hasMore = total > cards.length;

  return (
    <section className="relative z-10 block">
      <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:-mt-16 lg:px-8">
        <div className="mb-3 lg:mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#565959] sm:text-sm">
            Fresh in
          </p>
          <h2 className="mt-1 text-xl font-bold text-[#0f1111] sm:text-2xl">New Arrivals</h2>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-5">
          <div className="grid flex-1 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
            {cards.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                categoryName={product.categoryName}
                rating={product.rating}
                reviewCount={product.reviewCount}
                // Stacked, like the /products grid: the photo gets the top of
                // the card to itself and the text sits on white underneath.
                // The overlay layout drew the title/price over the lower half
                // of the photo, which hid the product itself.
                layout="stacked"
                // 4:5 matches the shape stills are uploaded in, so the photo is
                // flush with both card edges. A square box would pillarbox it
                // (contained portrait art = white bars left and right).
                aspect="aspect-[4/5]"
              />
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
