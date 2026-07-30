import { FadeIn } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RichText } from "@/components/RichText";
import { getAboutSections, getPage } from "@/lib/pages";

export const metadata = {
  title: "About Us | Ayursanthi",
  description:
    "Ayursanthi — a 400-year legacy of authentic Ayurveda, blending Jyothisham and rare manuscripts with modern science. Established 1960, Kerala, India.",
};

// Flat Amazon content-page treatment: white page, breadcrumb, ink headings and
// plain prose. Everything below the title comes from the admin Pages panel
// (subtitle + rich-text body), so the page is content-driven, not layout-driven.
export const revalidate = 300;

export default async function AboutPage() {
  const [page, sections] = await Promise.all([getPage("about"), getAboutSections()]);

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About Us" }]} />

        {/* Page title — plain heading over a hairline, Amazon content-page style. */}
        <header className="border-b border-border pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#0f1111] sm:text-3xl">
            About Ayursanthi
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#565959] sm:text-base sm:leading-7">
            {page.subtitle}
          </p>
        </header>

        {/* Brand story — full-width prose, no decorative imagery. */}
        <FadeIn className="border-b border-border py-8 sm:py-10">
          {page.title ? (
            <h2 className="text-xl font-bold text-[#0f1111] sm:text-2xl">{page.title}</h2>
          ) : null}
          <RichText
            body={page.body}
            className={`max-w-4xl text-sm leading-7 text-[#0f1111] sm:text-base sm:leading-8 ${page.title ? "mt-4" : ""}`}
          />
        </FadeIn>

        {/* Optional admin-added sections (Vision, Mission, …). Nothing renders
            here until an admin adds one in /admin/pages. */}
        {sections.map((section) => (
          <FadeIn key={section.slug} className="border-b border-border py-8 sm:py-10">
            {section.title ? (
              <h2 className="text-xl font-bold text-[#0f1111] sm:text-2xl">{section.title}</h2>
            ) : null}
            <RichText
              body={section.body}
              className={`max-w-4xl text-sm leading-7 text-[#0f1111] sm:text-base sm:leading-8 ${section.title ? "mt-4" : ""}`}
            />
          </FadeIn>
        ))}
      </div>

      <SiteFooter />
    </main>
  );
}
