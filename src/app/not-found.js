import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Page Not Found | Ayursanthi",
};

// Last-resort fallback for any URL that matches no route at all (a mistyped
// address, an old link to a page that no longer exists). The catalog's own dead
// links — a deleted product or a deleted collection — never reach here: those
// routes render their own "no longer available" page with live suggestions. This
// one exists so that even an unrecognised URL keeps the header, the footer and a
// way back into the store instead of the bare framework 404.
export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      <section className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
          404
        </p>
        <h1 className="mt-3 text-2xl font-bold text-[#0f1111] sm:text-3xl">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-3 text-sm text-[#565959]">
          The page you&apos;re looking for may have been moved or removed. The store
          itself is fine — pick up where you left off below.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="h-10 rounded-md bg-emerald-700 px-5 text-xs hover:bg-emerald-800">
            <Link href="/products">Browse All Products</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-10 rounded-md border-border px-5 text-xs text-[#0f1111]"
          >
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
