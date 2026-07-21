"use client";

import { useMemo, useState } from "react";
import { Star, Calendar } from "lucide-react";
import { RatingStars } from "@/components/ProductCard";

// Full review list for a product page: shows ALL reviews, with star filtering,
// sorting, and "load more" pagination so the page stays manageable as the count
// grows. Reviews are passed in pre-serialized from the server component:
//   { id, userName, rating, comment, createdAt (ISO string) }
//
// Mirrors the Amazon/Flipkart product-page pattern: a rating breakdown the
// shopper can click to filter, a sort dropdown, and incremental loading.

const PAGE_SIZE = 8;

const SORTS = {
  newest: { label: "Newest first", fn: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  oldest: { label: "Oldest first", fn: (a, b) => a.createdAt.localeCompare(b.createdAt) },
  highest: { label: "Highest rated", fn: (a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt) },
  lowest: { label: "Lowest rated", fn: (a, b) => a.rating - b.rating || b.createdAt.localeCompare(a.createdAt) },
};

export function ProductReviews({ reviews = [] }) {
  const [starFilter, setStarFilter] = useState(0); // 0 = all, else 1–5
  const [sort, setSort] = useState("newest");
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Count of reviews per star value (5→1), for the clickable breakdown bars.
  const distribution = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) counts[r.rating] = (counts[r.rating] || 0) + 1;
    return counts;
  }, [reviews]);

  const total = reviews.length;
  const average = total
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / total
    : 0;

  const filteredSorted = useMemo(() => {
    const base = starFilter ? reviews.filter((r) => r.rating === starFilter) : reviews;
    return [...base].sort(SORTS[sort].fn);
  }, [reviews, starFilter, sort]);

  const shown = filteredSorted.slice(0, visible);

  function applyStarFilter(star) {
    setStarFilter((current) => (current === star ? 0 : star));
    setVisible(PAGE_SIZE); // reset pagination when the filter changes
  }

  function changeSort(value) {
    setSort(value);
    setVisible(PAGE_SIZE);
  }

  if (total === 0) {
    return (
      <p className="mt-6 text-sm text-[#3f4545] italic">
        No reviews yet. Be the first to share your thoughts on this product!
      </p>
    );
  }

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[260px_1fr]">
      {/* Summary + clickable rating breakdown */}
      <aside className="h-fit rounded-md border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-3xl font-extrabold text-[#0f1111]">{average.toFixed(1)}</span>
          <div>
            <RatingStars rating={average} />
            <p className="mt-0.5 text-xs font-medium text-[#565959]">
              {total.toLocaleString("en-IN")} review{total > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[star] || 0;
            const pct = total ? (count / total) * 100 : 0;
            const active = starFilter === star;
            return (
              <button
                key={star}
                type="button"
                onClick={() => applyStarFilter(star)}
                aria-pressed={active}
                className={`group flex items-center gap-2 rounded px-1.5 py-1 text-left transition-colors ${
                  active ? "bg-emerald-50" : "hover:bg-slate-50"
                }`}
              >
                <span className="flex w-10 shrink-0 items-center gap-0.5 text-xs font-bold text-[#0f1111]">
                  {star}
                  <Star className="size-3 fill-amber-500 text-amber-500" />
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-8 shrink-0 text-right text-[11px] font-semibold text-slate-500">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {starFilter ? (
          <button
            type="button"
            onClick={() => applyStarFilter(starFilter)}
            className="mt-3 text-xs font-semibold text-emerald-700 hover:underline"
          >
            Clear filter
          </button>
        ) : null}
      </aside>

      {/* List controls + reviews */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-500">
            {starFilter
              ? `Showing ${filteredSorted.length} ${starFilter}-star review${filteredSorted.length === 1 ? "" : "s"}`
              : `All ${total} review${total === 1 ? "" : "s"}`}
          </p>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            Sort by
            <select
              value={sort}
              onChange={(e) => changeSort(e.target.value)}
              className="min-h-9 rounded border border-input bg-white px-2 text-xs font-normal text-slate-900 outline-none focus:border-emerald-700"
            >
              {Object.entries(SORTS).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filteredSorted.length === 0 ? (
          <p className="mt-6 text-sm italic text-[#3f4545]">
            No {starFilter}-star reviews yet.
          </p>
        ) : (
          <div className="mt-4 space-y-6">
            {shown.map((rev) => (
              <div key={rev.id} className="rounded-md border border-border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-950">{rev.userName}</p>
                  <div className="flex text-amber-500">
                    {Array.from({ length: rev.rating }).map((_, i) => (
                      <Star key={i} className="size-3.5 fill-current" />
                    ))}
                  </div>
                </div>
                {rev.comment ? (
                  <p className="mt-3 text-xs text-slate-600">{rev.comment}</p>
                ) : null}
                <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-[#565959]">
                  <Calendar className="size-3" />
                  {new Date(rev.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {visible < filteredSorted.length ? (
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="mt-6 inline-flex items-center justify-center rounded-md border border-[#adb1b8] px-5 py-2.5 text-sm font-bold text-[#0f1111] transition-colors hover:bg-[#232f3e] hover:text-white"
          >
            Load more reviews ({filteredSorted.length - visible} more)
          </button>
        ) : null}
      </div>
    </div>
  );
}
