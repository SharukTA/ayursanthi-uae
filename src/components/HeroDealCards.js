import { ProductCard } from "@/components/ProductCard";

// ─────────────────────────────────────────────────────────────────────────────
// HeroDealCards — the new-arrivals grid below the hero (no heading). It lists
// every active product, newest first, three per row on phones, tablets and
// laptops alike, and grows a row for every three products added. There is no
// "Show more" button: the whole range is already here.
//
// On laptops the grid is held to max-w-5xl. At the full page width each of the
// three cards would be ~400px wide, and with a 4:5 photo a single row would be
// taller than most laptop screens.
// ─────────────────────────────────────────────────────────────────────────────
export function HeroDealCards({ products = [] }) {
  if (products.length === 0) return null;

  // A store with exactly one product widens that card, matching the CMS product
  // carousels: at a third of the row a lone centred card reads as a mistake.
  const solo = products.length === 1;

  return (
    <section className="relative z-10 block">
      <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* A wrapping flex row rather than a grid, so a last row that isn't full
            (four products: three, then one) is centred instead of left-hung.
            Each basis is a third of the row minus its share of the two gaps
            (8 / 16 / 20px), which makes a full row exactly three across.
            `min-w-0` is what holds that: a flex item won't shrink below its
            content's widest unbreakable run by default, so a long one-line
            category label ("VARNA KALPA (BEAUTY CARE )") widened every card
            past a third and the row wrapped two-up on phones. */}
        <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-2 sm:gap-4 lg:gap-5">
          {products.map((product) => (
            <div
              key={product.id}
              className={`min-w-0 ${
                solo
                  ? "basis-[80%] sm:basis-[45%] lg:basis-[33.333%]"
                  : "basis-[calc((100%-1rem)/3)] sm:basis-[calc((100%-2rem)/3)] lg:basis-[calc((100%-2.5rem)/3)]"
              }`}
            >
              <ProductCard
                product={product}
                categoryName={product.categoryName}
                rating={product.rating}
                reviewCount={product.reviewCount}
                // Stacked, like the /products grid: the photo gets the top of
                // the card to itself and the text sits on white underneath.
                layout="stacked"
                // 4:5 — the exact shape stills are uploaded in (1122x1402), the
                // same box the /products grid uses, so "cover" crops nothing.
                aspect="aspect-[4/5]"
                mediaFit="cover"
                // A third of a phone is ~105px wide: tighten the text block and
                // the CTA there so the price and "Shop now" still fit.
                compact={!solo}
                // Must track the basis ladder above. Past lg the grid stops
                // growing at max-w-5xl (1024px), so a card never paints wider
                // than ~330px.
                sizes={
                  solo
                    ? "(max-width: 640px) 80vw, (max-width: 1024px) 45vw, 33vw"
                    : "(max-width: 1024px) 33vw, 330px"
                }
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
