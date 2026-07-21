import { HeaderSkeleton, Sk, ProductCardSkeleton } from "@/components/Skeletons";

// Category detail shows a product grid (not the circular directory), so it gets
// its own skeleton instead of inheriting the /categories one.
export default function CategoryDetailLoading() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <HeaderSkeleton />

      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 flex-1 w-full">
        <Sk className="h-8 w-56" />
        <Sk className="mt-3 h-4 w-80 max-w-full" />
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </main>
  );
}
