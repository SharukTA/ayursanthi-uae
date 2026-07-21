import { Scale } from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AnimatedHeading, AnimatedReveal } from "@/components/AnimatedText";
import { Tilt3D } from "@/components/Tilt3D";
import { RichText } from "@/components/RichText";
import { getPage } from "@/lib/pages";

export const metadata = {
  title: "Terms & Conditions | Ayursanthi",
  description: "Terms and conditions, refund policies, and affiliate rules for the Ayursanthi wellness platform.",
};

// Admin-editable page content (lib/pages.js falls back to defaults if unedited).
export const revalidate = 300;

export default async function TermsPage() {
  const page = await getPage("terms");

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-950 py-10 text-white sm:py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <PageReveal>
            <AnimatedHeading
              as="h1"
              text="Legal Policy & Terms"
              className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
              highlightWords={["Terms"]}
              highlightClassName=""
            />
            <AnimatedReveal delay={0.3}>
              <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">
                Please read our website policies, purchase terms, refund parameters, and affiliate guidelines carefully.
              </p>
            </AnimatedReveal>
          </PageReveal>
        </div>
      </section>

      {/* Content Container */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 flex-1">
        <Tilt3D maxTilt={4} scale={1.005}>
        <FadeIn className="prose prose-slate max-w-none rounded-md border border-border bg-white p-5 shadow-sm sm:p-8 lg:p-10">
          
          <div className="flex items-center gap-3 border-b border-[#d5d9d9] pb-6">
            <span className="flex size-10 items-center justify-center rounded-md bg-[#232f3e] text-white">
              <Scale className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-[#0f1111]">{page.title}</h2>
              {page.subtitle ? (
                <p className="text-xs font-medium text-[#565959]">{page.subtitle}</p>
              ) : null}
            </div>
          </div>

          <RichText body={page.body} className="mt-8 text-sm leading-7 text-slate-600" />
        </FadeIn>
        </Tilt3D>
      </section>

      <div className="mt-auto">
        <SiteFooter />
      </div>
    </main>
  );
}
