import { HelpCircle, MessageCircle } from "lucide-react";
import Link from "next/link";
import { FadeIn, PageReveal, Stagger, StaggerItem } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AnimatedHeading, AnimatedReveal } from "@/components/AnimatedText";
import { Tilt3D } from "@/components/Tilt3D";
import { getFaqs } from "@/lib/pages";

export const metadata = {
  title: "FAQ | Ayursanthi",
  description: "Frequently asked questions about Ayursanthi products, orders, payments, shipping, and returns.",
};

// Admin-managed FAQ list (lib/pages.js falls back to defaults if none exist).
export const revalidate = 300;

export default async function FAQPage() {
  const faqs = await getFaqs();

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-950 py-10 text-white sm:py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <PageReveal>
            <AnimatedHeading
              as="h1"
              text="Frequently Asked Questions"
              className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
              highlightWords={["Questions"]}
              highlightClassName=""
            />
            <AnimatedReveal delay={0.3}>
              <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">
                Quick answers to common queries about products, orders, payments, and delivery.
              </p>
            </AnimatedReveal>
          </PageReveal>
        </div>
      </section>

      {/* Content Container */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 flex-1 w-full">
        <Tilt3D maxTilt={4} scale={1.005}>
        <FadeIn className="rounded-md border border-border bg-white p-5 shadow-sm sm:p-8 lg:p-10">
          <div className="flex items-center gap-3 border-b border-[#d5d9d9] pb-6">
            <span className="flex size-10 items-center justify-center rounded-md bg-[#232f3e] text-white">
              <HelpCircle className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-[#0f1111]">Common Questions</h2>
              <p className="text-xs font-medium text-[#565959]">Tap any question below to view the answer.</p>
            </div>
          </div>

          <Stagger className="mt-8 divide-y divide-[#d5d9d9]">
            {faqs.map((item, idx) => (
              <StaggerItem key={idx}>
                <details className="group py-4">
                  <summary className="flex cursor-pointer items-start justify-between gap-4 text-sm font-bold text-[#0f1111] list-none">
                    <span className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#232f3e] text-[10px] font-extrabold text-white">
                        {idx + 1}
                      </span>
                      {item.question}
                    </span>
                    <span className="mt-0.5 shrink-0 text-[#0f1111] text-lg leading-none transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 pl-9 pr-6 text-sm leading-7 text-[#3f4545]">
                    {item.answer}
                  </p>
                </details>
              </StaggerItem>
            ))}
          </Stagger>
        </FadeIn>
        </Tilt3D>

        {/* Still need help banner */}
        <FadeIn className="mt-10 flex flex-col items-center gap-4 rounded-md border-2 border-[#d5d9d9] bg-white p-8 shadow-sm text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#232f3e] text-white">
              <MessageCircle className="size-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-[#0f1111]">Still have questions?</h3>
              <p className="mt-1 text-sm font-medium text-[#3f4545]">
                Our support team is happy to help with anything not covered above.
              </p>
            </div>
          </div>
          <Link
            href="/contact"
            className="inline-flex shrink-0 items-center justify-center rounded-md bg-[#232f3e] px-5 py-2.5 text-xs font-bold text-white ring-1 ring-inset ring-white/30 shadow-md transition-all hover:bg-[#131921] hover:-translate-y-0.5 hover:shadow-lg"
          >
            Contact Support
          </Link>
        </FadeIn>
      </section>

      <div className="mt-auto">
        <SiteFooter />
      </div>
    </main>
  );
}
