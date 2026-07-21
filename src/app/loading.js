import { HeaderSkeleton, Sk } from "@/components/Skeletons";

// Generic fallback shown during navigation to any route that doesn't have its
// own loading.js (cart, checkout, about, contact, etc.). Just a header stand-in
// and a few content bars so the click feels instant instead of frozen.
export default function RootLoading() {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      <HeaderSkeleton />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <Sk className="h-8 w-64 max-w-full" />
        <div className="mt-6 space-y-3">
          <Sk className="h-4 w-full" />
          <Sk className="h-4 w-11/12" />
          <Sk className="h-4 w-10/12" />
          <Sk className="h-4 w-3/4" />
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Sk key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    </main>
  );
}
