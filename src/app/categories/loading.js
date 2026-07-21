import { HeaderSkeleton, Sk } from "@/components/Skeletons";

// Shown instantly while the categories directory renders. Mirrors the grid of
// circular category icons (image + name + count) the real page shows.
export default function CategoriesLoading() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <HeaderSkeleton />

      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 flex-1 w-full">
        <div className="grid grid-cols-3 gap-x-4 gap-y-10 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-3">
              <Sk className="aspect-square w-full max-w-33 rounded-full" />
              <Sk className="h-4 w-3/4" />
              <Sk className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
