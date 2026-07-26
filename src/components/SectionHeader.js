import { FadeIn } from "@/components/Animated";

// A consistent eyebrow / heading / subtitle block for CMS sections. Renders only
// the parts the admin filled in.
//
// The page background is white across the whole site (only the navbar and
// footer carry the brand teal), so every section header uses the literal brand
// teal directly. A previous `dark` palette used light-on-dark utilities
// (text-white / text-slate-200 / text-emerald-200) for sections that no longer
// sit on a dark background; the globals.css flip rule can't reach those (no
// !important), so they rendered invisible on the white page.
//
// Lives in its own module (rather than inside HomeSections.js) so the client
// components that render personalised sections can reuse it without dragging
// every section renderer into the browser bundle.
export function SectionHeader({ section, center = false }) {
  const { eyebrow, title, subtitle } = section;
  if (!eyebrow && !title && !subtitle) return null;

  const eyebrowColor = "text-[#565959]";
  const titleColor = "text-[#0f1111]";
  const subtitleColor = "text-[#565959]";

  return (
    <FadeIn className={center ? "text-center" : ""}>
      {eyebrow ? (
        <p className={`text-sm font-bold uppercase tracking-wider ${eyebrowColor}`}>
          {eyebrow}
        </p>
      ) : null}
      {title ? (
        <h2 className={`mt-1 text-xl font-bold sm:text-2xl ${titleColor}`}>
          {title}
        </h2>
      ) : null}
      {subtitle ? (
        <p className={`mt-1 max-w-xl text-sm ${subtitleColor} ${center ? "mx-auto" : ""}`}>
          {subtitle}
        </p>
      ) : null}
    </FadeIn>
  );
}

// Amazon-style density: sections sit close together so more of the catalog is
// visible per screen. Keep the vertical rhythm here — every section type uses
// this shell, so this is the one knob that controls homepage spacing.
export const SECTION_SHELL = "mx-auto max-w-7xl px-4 py-1.5 sm:px-6 sm:py-6 lg:px-8";
