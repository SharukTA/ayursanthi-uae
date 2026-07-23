"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Star, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

// Amazon/Flipkart-style faceted filter rail. Every facet is reflected in the URL
// (?minPrice=…&minRating=4&inStock=1…) so the server component re-queries and the
// state is shareable / back-button friendly — exactly how both sites work. The
// same panel renders as a sticky left sidebar on desktop and inside a slide-over
// drawer on mobile (the "Filters" button below the search bar).
//
// The parent passes the *current* values as props (it already parsed them from
// searchParams), so this component never needs useSearchParams / Suspense.

const RATING_OPTIONS = [4, 3, 2, 1];
const DISCOUNT_OPTIONS = [10, 25, 35, 50];

// A titled facet block. Declared at module scope (not inside the component) so
// it isn't recreated every render — the React Compiler forbids in-render
// component definitions.
function Section({ title, children }) {
  return (
    <div className="border-b border-border py-4 first:pt-0 last:border-0">
      <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#0f1111]">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function CatalogFilters({
  categories = [],
  category = "",
  search = "",
  sort = "newest",
  view = "list",
  minPrice = "",
  maxPrice = "",
  minRating = "",
  minDiscount = "",
  inStock = false,
  featured = false,
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false); // mobile drawer
  // Only portal after mount (document exists) so SSR renders nothing extra.
  // One-shot mount flag — the canonical SSR-safe portal gate; the synchronous
  // setState is intentional and runs exactly once, so the rule is disabled here.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Lock background scroll while the drawer is open, restoring on close/unmount.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  // Price is applied on "Go" (Amazon-style) rather than on every keystroke.
  const [minInput, setMinInput] = useState(minPrice ?? "");
  const [maxInput, setMaxInput] = useState(maxPrice ?? "");

  // Merge the current facet state with `overrides` and build the /products URL.
  // Empty / falsy values are dropped so the query string stays clean.
  function hrefWith(overrides) {
    const state = {
      search,
      sort: sort !== "newest" ? sort : "",
      view: view !== "list" ? view : "",
      category,
      minPrice,
      maxPrice,
      minRating,
      minDiscount,
      inStock: inStock ? "1" : "",
      featured: featured ? "1" : "",
      ...overrides,
    };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(state)) {
      if (value !== "" && value != null && value !== false) params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/products?${qs}` : "/products";
  }

  function commit(overrides) {
    router.push(hrefWith(overrides));
    setOpen(false);
  }

  // A facet that's already active toggles off when clicked again.
  const toggle = (key, current, value) => commit({ [key]: current === value ? "" : value });

  function applyPrice() {
    commit({ minPrice: minInput || "", maxPrice: maxInput || "" });
  }

  const anyActive =
    Boolean(category) ||
    minPrice !== "" ||
    maxPrice !== "" ||
    minRating !== "" ||
    minDiscount !== "" ||
    inStock ||
    featured;

  const panel = (
    <div className="flex flex-col">
      {/* Department */}
      <Section title="Department">
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => commit({ category: "" })}
            className={`rounded-md px-2.5 py-1.5 text-left text-xs font-semibold transition ${
              !category ? "bg-[#232f3e] text-white shadow-sm" : "text-[#0f1111] hover:bg-emerald-50"
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggle("category", category, cat.slug)}
              className={`rounded-md px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                category === cat.slug
                  ? "bg-[#232f3e] text-white shadow-sm"
                  : "text-[#0f1111] hover:bg-emerald-50"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </Section>

      {/* Price */}
      <Section title="Price">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={minInput}
            onChange={(e) => setMinInput(e.target.value)}
            placeholder="Min"
            className="w-full min-w-0 rounded-md border border-border bg-white px-2 py-1.5 text-xs text-[#0f1111] outline-none focus:border-emerald-700"
          />
          <span className="text-xs text-[#565959]">–</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            placeholder="Max"
            className="w-full min-w-0 rounded-md border border-border bg-white px-2 py-1.5 text-xs text-[#0f1111] outline-none focus:border-emerald-700"
          />
          <Button
            type="button"
            onClick={applyPrice}
            className="h-8 shrink-0 rounded-md bg-emerald-700 px-3 text-xs hover:bg-emerald-800"
          >
            Go
          </Button>
        </div>
      </Section>

      {/* Customer review */}
      <Section title="Customer Review">
        <div className="flex flex-col gap-0.5">
          {RATING_OPTIONS.map((r) => {
            const active = String(minRating) === String(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggle("minRating", String(minRating), String(r))}
                aria-pressed={active}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition ${
                  active ? "bg-emerald-50" : "hover:bg-slate-50"
                }`}
              >
                <span className="flex">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star
                      key={i}
                      className={`size-3.5 ${i < r ? "fill-amber-500 text-amber-500" : "fill-[#d5d9d9] text-[#d5d9d9]"}`}
                    />
                  ))}
                </span>
                <span className="text-xs font-semibold text-[#0f1111]">&amp; Up</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Discount */}
      <Section title="Discount">
        <div className="flex flex-col gap-0.5">
          {DISCOUNT_OPTIONS.map((d) => {
            const active = String(minDiscount) === String(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggle("minDiscount", String(minDiscount), String(d))}
                aria-pressed={active}
                className={`rounded-md px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                  active ? "bg-emerald-50 text-[#0f1111]" : "text-[#0f1111] hover:bg-slate-50"
                }`}
              >
                {d}% Off or more
              </button>
            );
          })}
        </div>
      </Section>

      {/* Availability + best sellers */}
      <Section title="Availability">
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 hover:bg-slate-50">
          <span
            className={`flex size-4 items-center justify-center rounded border ${
              inStock ? "border-emerald-700 bg-emerald-700 text-white" : "border-[#adb1b8] bg-white"
            }`}
          >
            {inStock ? <Check className="size-3" /> : null}
          </span>
          <input
            type="checkbox"
            checked={inStock}
            onChange={() => commit({ inStock: inStock ? "" : "1" })}
            className="sr-only"
          />
          <span className="text-xs font-semibold text-[#0f1111]">In stock only</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 hover:bg-slate-50">
          <span
            className={`flex size-4 items-center justify-center rounded border ${
              featured ? "border-emerald-700 bg-emerald-700 text-white" : "border-[#adb1b8] bg-white"
            }`}
          >
            {featured ? <Check className="size-3" /> : null}
          </span>
          <input
            type="checkbox"
            checked={featured}
            onChange={() => commit({ featured: featured ? "" : "1" })}
            className="sr-only"
          />
          <span className="text-xs font-semibold text-[#0f1111]">Best sellers</span>
        </label>
      </Section>

      {anyActive ? (
        <button
          type="button"
          onClick={() => {
            setMinInput("");
            setMaxInput("");
            commit({
              category: "",
              minPrice: "",
              maxPrice: "",
              minRating: "",
              minDiscount: "",
              inStock: "",
              featured: "",
            });
          }}
          className="mt-4 text-xs font-semibold text-emerald-700 hover:underline"
        >
          Clear all filters
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-4 rounded-md border border-border bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 border-b border-border pb-3 text-sm font-bold uppercase tracking-wider text-[#0f1111]">
            <SlidersHorizontal className="size-4" />
            Filters
          </h2>
          {panel}
        </div>
      </aside>

      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-4 py-1.5 text-xs font-semibold text-[#0f1111] shadow-sm transition hover:bg-emerald-50 lg:hidden"
      >
        <SlidersHorizontal className="size-3.5" />
        Filters
        {anyActive ? <span className="size-1.5 rounded-full bg-emerald-600" /> : null}
      </button>

      {/* Mobile drawer — portaled to <body> so it escapes the transformed
          ScrollAwareFilters ancestor (a `transform` ancestor becomes the
          containing block for `position: fixed`, which would otherwise trap the
          drawer inside the small sticky bar and shrink it). At the body level,
          `fixed inset-0` fills the whole viewport top-to-bottom. */}
      {open && mounted
        ? createPortal(
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute inset-y-0 left-0 flex h-full w-[85%] max-w-sm flex-col bg-white shadow-2xl">
                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                  <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#0f1111]">
                    <SlidersHorizontal className="size-4" />
                    Filters
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close filters"
                    className="rounded-full p-1.5 text-[#565959] hover:bg-slate-100"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-2">{panel}</div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
