import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";

// ─────────────────────────────────────────────────────────────────────────────
// HeroDealCards — a laptop-only strip that overlaps the bottom edge of the hero,
// showing the four newest products as deal-style cards (the same ProductCard the
// catalog uses). A negative top margin pulls it up so it floats over the hero's
// lower edge, Amazon-deals-row style.
//
// Laptop only, by design: the whole section is `hidden lg:block`, so on mobile
// it renders nothing and takes no space — the phone homepage is unchanged. When
// more than the four shown products exist, a "Show more" button links to the
// full catalog (never expands inline).
// ─────────────────────────────────────────────────────────────────────────────
export function HeroDealCards({ products = [], total = 0 }) {
  const cards = products.slice(0, 4);
  if (cards.length === 0) return null;

  const hasMore = total > cards.length;

  return (
    <section className="relative z-10 hidden lg:block">
      <div className="mx-auto -mt-16 max-w-7xl px-8">
        <div className="mb-4">
          <p className="text-sm font-bold uppercase tracking-wider text-[#565959]">
            Fresh in
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[#0f1111]">New Arrivals</h2>
        </div>

        <div className="flex items-center gap-5">
          <div className="grid flex-1 grid-cols-4 gap-5">
            {cards.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                categoryName={product.categoryName}
                rating={product.rating}
                reviewCount={product.reviewCount}
              />
            ))}
          </div>

          {hasMore ? (
            <Link
              href="/products"
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#232f3e] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#131921]"
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
