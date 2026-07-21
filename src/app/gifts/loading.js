import { HeaderSkeleton, Sk, ProductCardSkeleton } from "@/components/Skeletons";

// Shown instantly while the gifts catalog renders on the server. Mirrors the real
// page shell: teal hero band, status panel, then tiered gift grids.
export default function GiftsLoading() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <HeaderSkeleton />

      <section className="bg-linear-to-br from-[#232f3e] to-[#131921] py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-3">
          <Sk className="h-6 w-40" style={{ backgroundColor: "rgba(255,255,255,0.25)" }} />
          <Sk className="h-9 w-2/3" style={{ backgroundColor: "rgba(255,255,255,0.25)" }} />
          <Sk className="h-4 w-1/2" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <Sk className="h-24 w-full rounded-xl" />

        {Array.from({ length: 2 }).map((_, s) => (
          <div key={s} className="mt-10">
            <Sk className="h-6 w-48" />
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
