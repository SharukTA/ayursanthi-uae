import { HeaderSkeleton, Sk } from "@/components/Skeletons";

// Shown instantly while a product detail page renders. Two-column layout
// (gallery left, buy box right) mirroring the real page.
export default function ProductDetailLoading() {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      <HeaderSkeleton />

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Gallery */}
          <div className="space-y-4">
            <Sk className="aspect-square w-full" style={{ backgroundColor: "#eef2f6" }} />
            <div className="flex gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Sk key={i} className="size-16 sm:size-20" />
              ))}
            </div>
          </div>

          {/* Buy box */}
          <div className="space-y-4">
            <Sk className="h-4 w-24" />
            <Sk className="h-8 w-4/5" />
            <Sk className="h-5 w-1/3" />
            <Sk className="h-7 w-40" />
            <div className="space-y-2 pt-2">
              <Sk className="h-4 w-full" />
              <Sk className="h-4 w-11/12" />
              <Sk className="h-4 w-3/4" />
            </div>
            <div className="flex gap-3 pt-4">
              <Sk className="h-12 w-40" />
              <Sk className="h-12 w-40" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
