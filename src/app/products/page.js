import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Search, SlidersHorizontal, ArrowUpDown, Check } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { ProductsResults } from "@/components/ProductsResults";
import { ScrollAwareFilters } from "@/components/ScrollAwareFilters";
import { getCatalogPage } from "@/lib/catalog";

export const metadata = {
  title: "Products Catalog | Ayursanthi",
  description: "Browse premium ayurvedic wellness products, hair care formulations, and digestive powders.",
};

export default async function ProductsPage({ searchParams }) {
  const params = await searchParams;
  const search = params.search || "";
  const categorySlug = params.category || "";
  const sort = params.sort || "newest";

  // Sort options shared by the top-bar dropdown; the label of the active one is
  // surfaced on the Sort button so users see the current choice at a glance.
  const sortOptions = [
    { label: "Newest Arrivals", value: "newest" },
    { label: "Price: Low to High", value: "price-asc" },
    { label: "Price: High to Low", value: "price-desc" },
  ];
  const currentSortLabel =
    sortOptions.find((opt) => opt.value === sort)?.label || sortOptions[0].label;

  // First page of results, rendered server-side for SEO and a fast first paint.
  // Subsequent pages are loaded client-side via /api/catalog (infinite scroll).
  const { products, total, hasMore } = await getCatalogPage({
    search,
    category: categorySlug,
    sort,
    page: 1,
  });

  // Query active categories for filtering sidebar
  const categories = await prisma.category.findMany({
    where: { isActive: true },
  });

  // Sort control reused in two places: the mobile top-bar and the desktop
  // results header. Same options, same active-state styling.
  const sortDropdown = (
    <details className="group relative shrink-0 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-[#0f1111] transition hover:bg-emerald-50">
        <ArrowUpDown className="size-3.5" />
        Sort: {currentSortLabel}
        <span className="text-[10px] transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-md border border-border bg-white p-1 shadow-lg">
        {sortOptions.map((opt) => (
          <Link
            key={opt.value}
            href={`/products?sort=${opt.value}${
              categorySlug ? `&category=${categorySlug}` : ""
            }${search ? `&search=${search}` : ""}`}
            className={`flex items-center justify-between gap-2 rounded px-3 py-2 text-xs font-semibold transition ${
              sort === opt.value
                ? "bg-emerald-50 text-[#0f1111]"
                : "text-[#0f1111] hover:bg-emerald-50"
            }`}
          >
            {opt.label}
            {sort === opt.value ? <Check className="size-3.5 shrink-0" /> : null}
          </Link>
        ))}
      </div>
    </details>
  );

  // Result-count summary, shared by the mobile bar and the desktop header.
  // Uses the full match `total`, not just the first page that's rendered.
  const resultSummary = `${
    total === 0 ? "No results" : `${total} ${total === 1 ? "result" : "results"}`
  }${search ? ` for "${search}"` : ""}`;

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      {/* Main Content — Amazon desktop (left sidebar) / Amazon mobile (top bar) */}
      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 flex-1 w-full">
        <div className="flex flex-col gap-5">

          {/* Sticky on mobile: this bar hides as you scroll DOWN the long list
              and slides back in the moment you scroll UP (Amazon-mobile style).
              On lg+ it reverts to a normal static block above the grid. */}
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
            <Button type="submit" className="h-9 bg-emerald-700 hover:bg-emerald-800 px-4 rounded-md">
              Search
            </Button>
          </form>

          {/* MOBILE filter bar (hidden on lg): category chips + Sort dropdown */}
          <div className="flex flex-col gap-3 rounded-md border border-border bg-white p-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 lg:hidden">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <span className="hidden shrink-0 items-center gap-1.5 pr-1 text-[11px] font-bold uppercase tracking-wider text-[#0f1111] sm:flex">
                <SlidersHorizontal className="size-3.5" />
                Filter
              </span>
              <Link
                href={`/products?sort=${sort}${search ? `&search=${search}` : ""}`}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  !categorySlug
                    ? "bg-[#232f3e] text-[#ffffff] shadow-sm"
                    : "border border-border text-[#0f1111] hover:bg-emerald-50"
                }`}
              >
                All
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/products?category=${cat.slug}&sort=${sort}${
                    search ? `&search=${search}` : ""
                  }`}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    categorySlug === cat.slug
                      ? "bg-[#232f3e] text-[#ffffff] shadow-sm"
                      : "border border-border text-[#0f1111] hover:bg-emerald-50"
                  }`}
                >
                  {cat.name}
                </Link>
              ))}
            </div>
            {sortDropdown}
          </div>

          </ScrollAwareFilters>

          {/* DESKTOP layout: left sidebar filters + results column */}
          <div className="grid gap-6 lg:grid-cols-[230px_1fr] lg:gap-8">

            {/* Left sidebar — hidden below lg (Amazon desktop) */}
            <aside className="hidden lg:block">
              <div className="rounded-md border border-border bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#0f1111]">
                  <SlidersHorizontal className="size-4" />
                  Department
                </h2>
                <div className="mt-4 flex flex-col gap-1">
                  <Link
                    href={`/products?sort=${sort}${search ? `&search=${search}` : ""}`}
                    className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                      !categorySlug
                        ? "bg-[#232f3e] text-[#ffffff] shadow-sm"
                        : "text-[#0f1111] hover:bg-emerald-50"
                    }`}
                  >
                    All Categories
                  </Link>
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/products?category=${cat.slug}&sort=${sort}${
                        search ? `&search=${search}` : ""
                      }`}
                      className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                        categorySlug === cat.slug
                          ? "bg-[#232f3e] text-[#ffffff] shadow-sm"
                          : "text-[#0f1111] hover:bg-emerald-50"
                      }`}
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            </aside>

            {/* Results column */}
            <div className="flex flex-col gap-4">
              {/* Results header: count on the left, Sort dropdown on the right (lg only) */}
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <p className="text-xs font-semibold text-slate-500 sm:text-sm">{resultSummary}</p>
                <div className="hidden lg:block">{sortDropdown}</div>
              </div>

              {/* Products list — server-rendered first page, then infinite
                  scroll with a bottom-right loading / load-more control. */}
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
                  key={`${categorySlug}|${sort}|${search}`}
                  initialProducts={products}
                  initialHasMore={hasMore}
                  search={search}
                  category={categorySlug}
                  sort={sort}
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
