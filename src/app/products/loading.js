import { HeaderSkeleton, Sk, ProductCardSkeleton } from "@/components/Skeletons";

// Shown instantly while the products listing renders on the server. Mirrors the
// real page shell: header, filter bar, optional desktop sidebar, results grid.
export default function ProductsLoading() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <HeaderSkeleton />

      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 flex-1 w-full">
        <div className="flex flex-col gap-5">
          {/* Search bar */}
          <Sk className="h-12 w-full" />

          <div className="grid gap-6 lg:grid-cols-[230px_1fr] lg:gap-8">
            {/* Desktop sidebar */}
            <aside className="hidden lg:block">
              <div className="space-y-3 rounded-md border border-border bg-white p-5">
                <Sk className="h-4 w-1/2" />
                {Array.from({ length: 6 }).map((_, i) => (
                  <Sk key={i} className="h-8 w-full" />
                ))}
              </div>
            </aside>

            {/* Results */}
            <div className="flex flex-col gap-4">
              <Sk className="h-5 w-40" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
