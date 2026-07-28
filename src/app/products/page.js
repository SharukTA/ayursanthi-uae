import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Search, ArrowUpDown, Check, LayoutGrid, List, X } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { ProductsResults } from "@/components/ProductsResults";
import { ScrollAwareFilters } from "@/components/ScrollAwareFilters";
import { CatalogFilters } from "@/components/CatalogFilters";
import { getCatalogPage } from "@/lib/catalog";
import { CURRENCY } from "@/lib/currency";

export const metadata = {
  title: "Products Catalog | Ayursanthi",
  description: "Browse premium ayurvedic wellness products, hair care formulations, and digestive powders.",
};

// The full sort set, mirroring Amazon/Flipkart's "Sort by" menu. The active
// label is surfaced on the Sort button so the current choice is visible.
const sortOptions = [
  { label: "Newest Arrivals", value: "newest" },
  { label: "Popularity", value: "popular" },
  { label: "Avg. Customer Review", value: "rating" },
  { label: "Price: Low to High", value: "price-asc" },
  { label: "Price: High to Low", value: "price-desc" },
  { label: "Discount", value: "discount" },
];

export default async function ProductsPage({ searchParams }) {
  const params = await searchParams;
  const search = params.search || "";
  const categorySlug = params.category || "";
  const sort = params.sort || "newest";
  const view = params.view === "grid" ? "grid" : "list";

  // Facet filters — kept as strings for URL round-tripping; the catalog layer
  // normalizes them. Toggles are read as real booleans.
  const minPrice = params.minPrice || "";
  const maxPrice = params.maxPrice || "";
  const minRating = params.minRating || "";
  const minDiscount = params.minDiscount || "";
  const inStock = params.inStock === "1" || params.inStock === "true";
  const featured = params.featured === "1" || params.featured === "true";

  const currentSortLabel =
    sortOptions.find((opt) => opt.value === sort)?.label || sortOptions[0].label;

  // Canonical facet state → any /products URL, dropping empty/default values.
  const filterState = {
    search,
    category: categorySlug,
    sort,
    view,
    minPrice,
    maxPrice,
    minRating,
    minDiscount,
    inStock,
    featured,
  };
  function buildHref(overrides = {}) {
    const s = { ...filterState, ...overrides };
    const p = new URLSearchParams();
    if (s.search) p.set("search", s.search);
    if (s.category) p.set("category", s.category);
    if (s.sort && s.sort !== "newest") p.set("sort", s.sort);
    if (s.view && s.view !== "list") p.set("view", s.view);
    if (s.minPrice) p.set("minPrice", s.minPrice);
    if (s.maxPrice) p.set("maxPrice", s.maxPrice);
    if (s.minRating) p.set("minRating", s.minRating);
    if (s.minDiscount) p.set("minDiscount", s.minDiscount);
    if (s.inStock) p.set("inStock", "1");
    if (s.featured) p.set("featured", "1");
    const qs = p.toString();
    return qs ? `/products?${qs}` : "/products";
  }

  // First page of results, rendered server-side for SEO and a fast first paint.
  // Subsequent pages load client-side via /api/catalog (infinite scroll).
  const { products, total, hasMore } = await getCatalogPage({
    search,
    category: categorySlug,
    sort,
    page: 1,
    minPrice,
    maxPrice,
    minRating,
    minDiscount,
    inStock,
    featured,
  });

  const categories = await prisma.category.findMany({
    where: { isActive: true },
  });
  const categoryName = categorySlug
    ? categories.find((c) => c.slug === categorySlug)?.name || categorySlug
    : "";

  // Result-count summary uses the full match `total`, not just the first page.
  const resultSummary = `${
    total === 0 ? "No results" : `${total} ${total === 1 ? "result" : "results"}`
  }${search ? ` for "${search}"` : ""}`;

  // Active-filter chips (Amazon/Flipkart pattern): each removes just its facet.
  const activeChips = [];
  if (categoryName) activeChips.push({ label: categoryName, href: buildHref({ category: "" }) });
  if (minPrice || maxPrice) {
    activeChips.push({
      // Raw query values, not amounts we computed — shown verbatim with a single
      // leading code rather than formatted twice.
      label: `${CURRENCY} ${minPrice || "0"} – ${maxPrice || "∞"}`,
      href: buildHref({ minPrice: "", maxPrice: "" }),
    });
  }
  if (minRating) activeChips.push({ label: `${minRating}★ & Up`, href: buildHref({ minRating: "" }) });
  if (minDiscount) activeChips.push({ label: `${minDiscount}% Off+`, href: buildHref({ minDiscount: "" }) });
  if (inStock) activeChips.push({ label: "In stock", href: buildHref({ inStock: false }) });
  if (featured) activeChips.push({ label: "Best sellers", href: buildHref({ featured: false }) });

  // Sort control reused in the mobile bar and the desktop results header.
  const sortDropdown = (
    // `min-w-0` + a truncating label: on a narrow phone the mobile control bar
    // holds Filters + view toggle + this button, and a non-shrinking pill with
    // the longest label ("Sort: Avg. Customer Review") pushed itself out past
    // the bar's rounded edge. It now shrinks and ellipsises instead.
    <details className="group relative min-w-0 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-[#0f1111] transition hover:bg-emerald-50 sm:gap-2 sm:px-4">
        <ArrowUpDown className="size-3.5 shrink-0" />
        <span className="truncate">Sort: {currentSortLabel}</span>
        <span className="shrink-0 text-[10px] transition-transform group-open:rotate-180">▾</span>
      </summary>
      {/* Capped to the viewport so the panel never hangs off-screen either. */}
      <div className="absolute right-0 z-20 mt-2 w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-border bg-white p-1 shadow-lg">
        {sortOptions.map((opt) => (
          <Link
            key={opt.value}
            href={buildHref({ sort: opt.value })}
            className={`flex items-center justify-between gap-2 rounded px-3 py-2 text-xs font-semibold transition ${
              sort === opt.value ? "bg-emerald-50 text-[#0f1111]" : "text-[#0f1111] hover:bg-emerald-50"
            }`}
          >
            {opt.label}
            {sort === opt.value ? <Check className="size-3.5 shrink-0" /> : null}
          </Link>
        ))}
      </div>
    </details>
  );

  // Grid / list view toggle.
  const viewToggle = (
    <div className="flex shrink-0 items-center rounded-full border border-border bg-white p-0.5">
      <Link
        href={buildHref({ view: "list" })}
        aria-label="List view"
        className={`flex size-7 items-center justify-center rounded-full transition ${
          view === "list" ? "bg-[#232f3e] text-white" : "text-[#565959] hover:bg-emerald-50"
        }`}
      >
        <List className="size-3.5" />
      </Link>
      <Link
        href={buildHref({ view: "grid" })}
        aria-label="Grid view"
        className={`flex size-7 items-center justify-center rounded-full transition ${
          view === "grid" ? "bg-[#232f3e] text-white" : "text-[#565959] hover:bg-emerald-50"
        }`}
      >
        <LayoutGrid className="size-3.5" />
      </Link>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 flex-1 w-full">
        <div className="flex flex-col gap-5">
          {/* Sticky on mobile: hides on scroll-down, reveals on scroll-up. */}
          <ScrollAwareFilters>
            {/* Search bar — full width on both viewports */}
            <form className="flex w-full rounded-md border border-border bg-white p-1.5 shadow-sm">
              <label className="flex flex-1 items-center gap-3 px-3 text-slate-700">
                <Search className="size-4 text-slate-400" />
                <input
                  type="text"
                  name="search"
                  defaultValue={search}
                  placeholder="Search remedies..."
                  className="search-bare w-full bg-transparent text-sm outline-none"
                />
              </label>
              {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
              <input type="hidden" name="sort" value={sort} />
              {view === "grid" && <input type="hidden" name="view" value="grid" />}
              <Button type="submit" className="h-9 bg-emerald-700 hover:bg-emerald-800 px-4 rounded-md">
                Search
              </Button>
            </form>

            {/* MOBILE control bar (hidden on lg): Filters + Sort + View */}
            <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-white p-2 shadow-sm lg:hidden">
              <CatalogFilters
                categories={categories}
                category={categorySlug}
                search={search}
                sort={sort}
                view={view}
                minPrice={minPrice}
                maxPrice={maxPrice}
                minRating={minRating}
                minDiscount={minDiscount}
                inStock={inStock}
                featured={featured}
              />
              {/* `min-w-0` lets the sort pill shrink inside this bar instead of
                  overflowing it on narrow phones. */}
              <div className="flex min-w-0 items-center gap-2">
                {viewToggle}
                {sortDropdown}
              </div>
            </div>
          </ScrollAwareFilters>

          {/* DESKTOP layout: left facet sidebar + results column */}
          <div className="grid gap-6 lg:grid-cols-[240px_1fr] lg:gap-8">
            {/* CatalogFilters renders the desktop sidebar here; on mobile its
                trigger already lives in the control bar above, so only the
                (hidden) sidebar markup collapses away. */}
            <div className="hidden lg:block">
              <CatalogFilters
                categories={categories}
                category={categorySlug}
                search={search}
                sort={sort}
                view={view}
                minPrice={minPrice}
                maxPrice={maxPrice}
                minRating={minRating}
                minDiscount={minDiscount}
                inStock={inStock}
                featured={featured}
              />
            </div>

            {/* Results column */}
            <div className="flex flex-col gap-4">
              {/* Results header: count on the left, view + sort on the right (lg) */}
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <p className="text-xs font-semibold text-slate-500 sm:text-sm">{resultSummary}</p>
                <div className="hidden items-center gap-2 lg:flex">
                  {viewToggle}
                  {sortDropdown}
                </div>
              </div>

              {/* Active-filter chips */}
              {activeChips.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {activeChips.map((chip) => (
                    <Link
                      key={chip.label}
                      href={chip.href}
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                    >
                      {chip.label}
                      <X className="size-3" />
                    </Link>
                  ))}
                  <Link href="/products" className="text-xs font-semibold text-emerald-700 hover:underline">
                    Clear all
                  </Link>
                </div>
              ) : null}

              {/* Products — server-rendered first page, then infinite scroll. */}
              {total === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-white py-20 text-center">
                  <p className="text-sm font-semibold text-slate-500">
                    No products found matching your criteria.
                  </p>
                  <Link
                    href="/products"
                    className="mt-3 inline-block text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Clear Filters
                  </Link>
                </div>
              ) : (
                <ProductsResults
                  key={`${categorySlug}|${sort}|${search}|${view}|${minPrice}|${maxPrice}|${minRating}|${minDiscount}|${inStock}|${featured}`}
                  initialProducts={products}
                  initialHasMore={hasMore}
                  search={search}
                  category={categorySlug}
                  sort={sort}
                  view={view}
                  filters={{
                    minPrice,
                    maxPrice,
                    minRating,
                    minDiscount,
                    inStock: inStock ? "1" : "",
                    featured: featured ? "1" : "",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
