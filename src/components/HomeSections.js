import Link from "next/link";
import {
  ChevronRight,
  Sparkles,
  TicketCheck,
  Users,
  ShoppingBag,
  ShieldCheck,
  LayoutGrid,
} from "lucide-react";
import { RatingStars } from "@/components/ProductCard";
import { ShopNowButton } from "@/components/ShopNowButton";
import { Tilt3D } from "@/components/Tilt3D";
import { FaceVideoCarousel } from "@/components/FaceVideoCarousel";
import { FeaturedCarousel } from "@/components/FeaturedCarousel";
import { SectionCarousel } from "@/components/SectionCarousel";
import { ImageFill } from "@/components/ProductMedia";
import { CardVideo } from "@/components/CardVideo";
import { SectionHeader, SECTION_SHELL } from "@/components/SectionHeader";
import { RecentlyViewedSection } from "@/components/RecentlyViewedSection";

// ─────────────────────────────────────────────────────────────────────────────
// HomeSections — the public renderer for the admin-managed homepage CMS.
//
// It receives the active HomeSection rows (with their active items, already
// ordered) and renders each one with the component that matches its `type`.
// Nothing here is hardcoded: if the admin added no sections, this renders
// nothing; a section with no items renders nothing. This mirrors how large
// stores (Amazon/Flipkart) compose their homepage from configurable modules.
// ─────────────────────────────────────────────────────────────────────────────

// Decimal/number → "Rs. 1,499" (Indian grouping). Returns null for empty values.
function formatRs(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `Rs. ${number.toLocaleString("en-IN")}`;
}

// Best link for an item: explicit href wins, else the linked product page.
function itemHref(item) {
  if (item.href) return item.href;
  if (item.product?.slug) return `/products/${item.product.slug}`;
  return null;
}

// SectionHeader + SECTION_SHELL now live in components/SectionHeader.js so the
// client-rendered personalised sections can share them.

// ── VIDEO_CAROUSEL ───────────────────────────────────────────────────────────
function VideoCarouselSection({ section }) {
  const videos = section.items
    .filter((item) => item.videoUrl)
    .map((item) => ({
      id: item.id,
      src: item.videoUrl,
      name: item.title || "",
      label: item.subtitle || "",
      price: item.badge || formatRs(item.product?.price),
      href: itemHref(item) || "/products",
    }));

  if (videos.length === 0) return null;

  return (
    <section className={SECTION_SHELL}>
      <SectionHeader section={section} />
      <div className={section.eyebrow || section.title ? "mt-4" : ""}>
        <FaceVideoCarousel items={videos} />
      </div>
    </section>
  );
}

// ── DEAL_GRID ────────────────────────────────────────────────────────────────
function DealGridSection({ section }) {
  const deals = section.items;
  if (deals.length === 0) return null;

  return (
    <section className={SECTION_SHELL}>
      <SectionHeader section={section} />

      <div className="mt-4">
        <SectionCarousel slideClassName="flex-[0_0_80%] sm:flex-[0_0_45%] lg:flex-[0_0_25%]">
          {deals.map((item) => {
            const href = itemHref(item) || "/products";
            return (
              // Container + stretched link rather than one big <Link>, so the
              // "Shop now" CTA can be a real <button>. See ProductCard.
              <div
                key={item.id}
                className="group relative block aspect-square h-full overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-[#f7fafa] to-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
              >
                <Link
                  href={href}
                  className="absolute inset-0 z-10"
                  aria-label={item.title || "Shop now"}
                />

                {/* Image fills the whole card, mirroring the product card */}
                {item.imageUrl ? (
                  <ImageFill
                    src={item.imageUrl}
                    alt={item.title || ""}
                    sizes="(max-width: 640px) 70vw, (max-width: 1024px) 45vw, 30vw"
                    className="transition-transform duration-500 group-hover:scale-[1.06]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-emerald-50" />
                )}

                {/* Badge floating over the image */}
                {item.badge ? (
                  <span className="absolute left-3 top-3 inline-block rounded-full bg-[#e11d48] px-2.5 py-1 text-[10px] font-extrabold text-[#ffffff] shadow-md">
                    {item.badge}
                  </span>
                ) : null}

                {/* Bottom gradient scrim with the overlaid title / subtitle / CTA */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0f1111]/95 via-[#0f1111]/65 to-transparent p-4 pt-14">
                  {item.subtitle ? (
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#ffffff]/70">
                      {item.subtitle}
                    </p>
                  ) : null}
                  {item.title ? (
                    <h3 className="mt-0.5 line-clamp-2 text-sm font-bold leading-5 text-[#ffffff] group-hover:underline">
                      {item.title}
                    </h3>
                  ) : null}
                  <ShopNowButton href={href} size="sm" className="mt-3" />
                </div>
              </div>
            );
          })}
        </SectionCarousel>
      </div>
    </section>
  );
}

// ── CATEGORY_GRID ────────────────────────────────────────────────────────────
// A single category rendered as a small Amazon-style round icon + label. The
// image fills a circle sitting on a soft brand ring; used in the two-row
// scroller below on every breakpoint (mobile and desktop alike).
function CategoryIconTile({ item }) {
  const href = itemHref(item) || "/categories";
  return (
    <Link href={href} className="group flex w-16 shrink-0 flex-col items-center gap-1.5 sm:w-28 lg:w-32">
      <div className="relative size-16 overflow-hidden rounded-full bg-[#f7fafa] p-1 ring-1 ring-[#d5d9d9] shadow-sm transition-shadow group-hover:shadow-md group-active:shadow-md sm:size-28 lg:size-32">
        {item.imageUrl ? (
          <ImageFill
            src={item.imageUrl}
            alt={item.title || ""}
            // Tops out at 128px (lg:size-32); a 2x variant is all it can use.
            sizes="128px"
            quality={50}
            className="rounded-full transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center rounded-full bg-emerald-50">
            <LayoutGrid className="size-6 text-[#565959]" />
          </div>
        )}
      </div>
      <span className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-[#0f1111] sm:text-xs">
        {item.title}
      </span>
    </Link>
  );
}

function CategoryGridSection({ section }) {
  const cards = section.items;
  if (cards.length === 0) return null;

  // Amazon-app style on EVERY breakpoint: the first row holds up to 10
  // categories, the second holds the next 9 followed by a "More" tile that opens
  // /categories. Both rows share one horizontally-scrollable track so they pan
  // together on mobile and desktop alike.
  const firstRow = cards.slice(0, 10);
  const secondRow = cards.slice(10, 19);

  return (
    <section className={SECTION_SHELL}>
      <SectionHeader section={section} center />

      <div className="mt-4 -mx-4 overflow-x-auto px-4 pb-2 scrollbar-none [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto flex w-max flex-col gap-6">
          <div className="flex gap-4 sm:gap-6">
            {firstRow.map((item) => (
              <CategoryIconTile key={item.id} item={item} />
            ))}
          </div>
          <div className="flex gap-4 sm:gap-6">
            {secondRow.map((item) => (
              <CategoryIconTile key={item.id} item={item} />
            ))}
            {/* "More" tile only appears once the second row's 9 cards are full
                (i.e. there are 19+ categories) so it never leaves a half-empty row. */}
            {secondRow.length === 9 ? (
              <Link
                href="/categories"
                className="group flex w-16 shrink-0 flex-col items-center gap-1.5 sm:w-28 lg:w-32"
              >
                <div className="flex size-16 items-center justify-center rounded-full border border-[#d5d9d9] bg-[#f7fafa] text-[#0f1111] transition-colors group-hover:bg-[#f7fafa] sm:size-28 lg:size-32">
                  <LayoutGrid className="size-6 sm:size-9" />
                </div>
                <span className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-[#0f1111] sm:text-xs">
                  More
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── PRODUCT_CAROUSEL ─────────────────────────────────────────────────────────
function ProductCarouselSection({ section }) {
  // PRODUCT_CAROUSEL items are pulled live from the catalog (see page-sections),
  // so each item carries a fully-populated `product` (incl. real review
  // aggregate) that the card renders directly.
  const products = section.items
    .map((item) => item.product)
    .filter((p) => p && p.name);

  if (products.length === 0) return null;

  return (
    <section className="relative">
      <div className={SECTION_SHELL}>
        <SectionHeader section={section} />
        <div className="mt-4">
          <FeaturedCarousel products={products} />
        </div>
      </div>
    </section>
  );
}

// ── PROMO_ADS ────────────────────────────────────────────────────────────────
function PromoAdsSection({ section }) {
  const ads = section.items;
  if (ads.length === 0) return null;

  return (
    <section className={SECTION_SHELL}>
      <SectionHeader section={section} />

      <div className="mt-4">
        {/* Near-full-width on phones (the remaining sliver still shows the next
            card, so it stays readable as a carousel); two up from sm. */}
        <SectionCarousel slideClassName="flex-[0_0_96%] sm:flex-[0_0_50%]">
        {ads.map((item) => {
          const href = itemHref(item) || "/products";
          const card = (
            // Portrait 4:5 on phones, because that is the shape the artwork
            // actually is: promo images are uploaded at 1122x1402, the same as
            // product photos. The image is painted with `object-cover`, so a
            // landscape card (this was 16:9, then 4:3) scaled a tall photo to
            // fill a wide box and cropped most of the top and bottom away —
            // making the card taller only ever cropped it harder. Matched to the
            // upload ratio it fills the card exactly: nothing cropped, no
            // letterboxing, and the card is far bigger on a phone.
            //
            // If promo artwork ever moves to landscape, this ratio has to move
            // with it — the two are a pair.
            <div className="group relative flex aspect-[4/5] h-full flex-col justify-end overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-[#f7fafa] to-white shadow-sm transition-all duration-300 hover:shadow-2xl sm:aspect-video">
              {/* Image fills the whole card, mirroring the category card */}
              {item.imageUrl ? (
                <ImageFill
                  src={item.imageUrl}
                  alt={item.title || ""}
                  sizes="(max-width: 640px) 96vw, 50vw"
                  className="transition-transform duration-500 group-hover:scale-[1.06]"
                />
              ) : (
                <div className="absolute inset-0 bg-emerald-50" />
              )}

              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50/90 px-2 py-1 text-[10px] font-bold text-emerald-800 backdrop-blur">
                <Sparkles className="size-3" />
                {item.badge || "Featured"}
              </span>

              {/* Bottom gradient scrim with the overlaid title / body */}
              <div className="relative bg-gradient-to-t from-[#0f1111]/95 via-[#0f1111]/65 to-transparent p-5 pt-14">
                <h3 className="text-lg font-bold text-[#ffffff] group-hover:underline">
                  {item.title}
                </h3>
                {item.body ? (
                  <p className="mt-2 text-sm leading-6 text-[#ffffff]/80 line-clamp-2">
                    {item.body}
                  </p>
                ) : null}
              </div>
            </div>
          );

          return (
            <Tilt3D key={item.id} maxTilt={8} scale={1.02} className="h-full">
              <Link href={href} className="block h-full">
                {card}
              </Link>
            </Tilt3D>
          );
        })}
        </SectionCarousel>
      </div>
    </section>
  );
}

// ── REVIEWS ──────────────────────────────────────────────────────────────────
// Items are real customer reviews injected by the data layer (page-sections.js),
// never admin-authored. Each carries the reviewer's name (`title`), their written
// comment (`body`), a star `rating`, and the `productName`/`href` they reviewed.
function ReviewsSection({ section }) {
  const reviews = section.items;
  if (reviews.length === 0) return null;

  return (
    <section className={SECTION_SHELL}>
      <SectionHeader section={section} />

      <div className="mt-4">
        <SectionCarousel slideClassName="flex-[0_0_62%] sm:flex-[0_0_45%] lg:flex-[0_0_30%]">
          {reviews.map((item) => {
            const card = (
              <div className="flex h-full flex-col rounded-xl border border-border bg-white p-3 shadow-sm transition-shadow hover:shadow-lg sm:p-4">
                {/* Header: product thumbnail + reviewer name + stars */}
                <div className="flex items-center gap-2 sm:gap-3">
                  {item.imageUrl && item.imageMediaType === "VIDEO" ? (
                    // A video only reaches this 36-48px thumbnail when the
                    // reviewed product has no photo at all; CardVideo keeps it
                    // unloaded until hover rather than autoplaying megabytes.
                    <span
                      data-media-hover-root
                      className="relative size-9 shrink-0 overflow-hidden rounded-lg border border-border bg-slate-100 sm:size-12"
                    >
                      <CardVideo
                        src={item.imageUrl}
                        showBadge={false}
                        className="absolute inset-0 size-full object-cover"
                      />
                    </span>
                  ) : item.imageUrl ? (
                    <span className="relative size-9 shrink-0 overflow-hidden rounded-lg border border-border bg-slate-100 sm:size-12">
                      <ImageFill
                        src={item.imageUrl}
                        alt={item.productName || ""}
                        sizes="48px"
                        quality={50}
                      />
                    </span>
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 sm:size-12">
                      <TicketCheck className="size-4 text-emerald-700 sm:size-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-950 sm:text-sm">{item.title}</p>
                    {typeof item.rating === "number" && item.rating > 0 ? (
                      <RatingStars rating={item.rating} size="size-3 sm:size-3.5" />
                    ) : null}
                  </div>
                </div>

                {item.body ? (
                  <blockquote className="mt-2.5 line-clamp-3 text-[11px] leading-4 text-slate-600 sm:mt-3 sm:text-xs sm:leading-5">
                    &ldquo;{item.body}&rdquo;
                  </blockquote>
                ) : null}

                {item.productName ? (
                  <p className="mt-auto flex items-center gap-1 pt-2.5 text-[10px] font-semibold text-emerald-700 sm:pt-3 sm:text-[11px]">
                    <span className="truncate">on {item.productName}</span>
                    <ChevronRight className="size-3 shrink-0" />
                  </p>
                ) : null}
              </div>
            );

            return item.href ? (
              <Link key={item.id} href={item.href} className="block h-full">
                {card}
              </Link>
            ) : (
              <div key={item.id} className="h-full">
                {card}
              </div>
            );
          })}
        </SectionCarousel>
      </div>
    </section>
  );
}

// ── STATS_BAR ────────────────────────────────────────────────────────────────
// Live metrics are computed server-side (passed in via `stats`); the admin only
// chooses WHICH metrics appear and their labels — never the numbers themselves.
const METRIC_ICONS = {
  REGISTERED_CUSTOMERS: Users,
  PAID_ORDERS: ShoppingBag,
  STATIC: ShieldCheck,
};

function StatsBarSection({ section, stats = {} }) {
  const entries = section.items
    .map((item) => {
      const metric = item.metric || "STATIC";
      // A metric that no longer exists (e.g. a retired one still saved on an old
      // item) has no number to show — drop the entry rather than render a "0".
      const Icon = METRIC_ICONS[metric];
      if (!Icon) return null;
      if (metric === "STATIC") {
        if (!item.title) return null;
        return { id: item.id, Icon, text: item.title };
      }
      const count = Number(stats[metric] || 0).toLocaleString("en-IN");
      const label = item.title ? ` ${item.title}` : "";
      return { id: item.id, Icon, text: `${count}${label}` };
    })
    .filter(Boolean);

  if (entries.length === 0) return null;

  // Duplicate the list so the marquee scrolls seamlessly.
  const loop = [...entries, ...entries];

  return (
    <section className="border-y border-emerald-100 bg-emerald-50/50 py-3 overflow-hidden sm:py-8">
      <div className="flex w-max animate-[marquee_30s_linear_infinite] gap-12 whitespace-nowrap [animation-play-state:running] hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] active:[animation-play-state:paused]">
        {loop.map((entry, idx) => {
          const Icon = entry.Icon;
          return (
            <span
              key={`${entry.id}-${idx}`}
              className="flex items-center gap-3 text-base font-bold uppercase tracking-wider text-emerald-900 sm:text-lg"
            >
              <Icon className="size-6 text-emerald-700 sm:size-7" />
              {entry.text}
              <span className="ml-12 text-emerald-700">•</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}

// Map each section type to its renderer. Adding a new HomeSectionType means
// adding a component above and a line here.
const RENDERERS = {
  VIDEO_CAROUSEL: VideoCarouselSection,
  DEAL_GRID: DealGridSection,
  CATEGORY_GRID: CategoryGridSection,
  PRODUCT_CAROUSEL: ProductCarouselSection,
  PROMO_ADS: PromoAdsSection,
  REVIEWS: ReviewsSection,
  STATS_BAR: StatsBarSection,
  // Same carousel of ProductCards as PRODUCT_CAROUSEL — only the data layer
  // differs (ranked by real paid sales instead of the whole catalog), so there
  // is nothing to duplicate here.
  BEST_SELLERS: ProductCarouselSection,
  // Rendered in the browser: its cards come from the visitor's own history, and
  // this page is ISR-cached across all visitors. See RecentlyViewedSection.
  RECENTLY_VIEWED: RecentlyViewedSection,
};

export function HomeSections({ sections = [], stats = {} }) {
  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((section) => {
        const Renderer = RENDERERS[section.type];
        if (!Renderer) return null;
        return <Renderer key={section.id} section={section} stats={stats} />;
      })}
    </>
  );
}

// The renderer is placement-agnostic — the same blocks render on product and
// category pages. `PageSections` is a clearer alias for those non-home callers.
export const PageSections = HomeSections;
