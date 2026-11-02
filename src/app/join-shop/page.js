import { ShopRequestForm } from "@/components/ShopRequestForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Join Business Partnership | Ayurshoppee",
  robots: { index: false, follow: false },
};

export default function JoinShopPage() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-50 text-white">
      <SiteHeader />
      <section className="bg-slate-950 py-10 text-center text-white sm:py-14">
        <div className="mx-auto max-w-xl px-4">
          <h1 className="text-3xl font-bold tracking-tight">Join Business Partnership</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Send us your details and we will contact you.
          </p>
        </div>
      </section>
      <section className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <div className="rounded-md border border-border bg-white p-6 shadow-sm">
          <ShopRequestForm />
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
