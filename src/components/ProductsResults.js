"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/Animated";
import { ProductListRow } from "@/components/ProductCard";

// Infinite-scroll catalog list. The server renders the first page and hands it
// in via `initialProducts`; from there this component fetches /api/catalog for
// each subsequent page. An IntersectionObserver auto-loads as the user nears the
// bottom, and a bottom-right "Load more" button doubles as the loading
// indicator and a manual / retry affordance (Amazon-style).
export function ProductsResults({
  initialProducts,
  initialHasMore,
  search = "",
  category = "",
  sort = "newest",
}) {
  const [products, setProducts] = useState(initialProducts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinelRef = useRef(null);

  // NOTE: a filter/sort/search change remounts this component (the parent keys
  // it on the active filters), so accumulated state resets to the new first
  // page automatically — no reset effect needed here.

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(false);
    const next = page + 1;
    try {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (category) qs.set("category", category);
      if (sort) qs.set("sort", sort);
      qs.set("page", String(next));

      const res = await fetch(`/api/catalog?${qs.toString()}`);
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();

      setProducts((prev) => [...prev, ...data.products]);
      setPage(next);
      setHasMore(data.hasMore);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, search, category, sort]);

  // Auto-load when the sentinel scrolls into view. `rootMargin` pre-fetches the
  // next page before the user actually hits the bottom for a seamless feel.
  useEffect(() => {
    if (!hasMore || error) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, error, loadMore]);

  return (
    <>
      <Stagger className="flex flex-col gap-3 sm:gap-4">
        {products.map((product) => (
          <StaggerItem key={product.id}>
            <ProductListRow
              product={product}
              categoryName={product.categoryName}
              rating={product.rating}
              reviewCount={product.reviewCount}
            />
          </StaggerItem>
        ))}
      </Stagger>

      {/* Infinite-scroll trigger + bottom-right loading / load-more control */}
      {hasMore ? (
        <>
          <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-5 py-2.5 text-xs font-bold text-[#ffffff] shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-80"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </>
              ) : error ? (
                <>
                  <RotateCw className="size-4" />
                  Retry
                </>
              ) : (
                "Load more products"
              )}
            </button>
          </div>
        </>
      ) : (
        products.length > 0 && (
          <p className="pt-3 text-center text-xs font-medium text-slate-400">
            You&apos;ve reached the end of the catalog.
          </p>
        )
      )}
    </>
  );
}
