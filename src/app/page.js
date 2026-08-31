import { SiteFooter } from "@/components/SiteFooter";
import { HomeTop } from "@/components/HomeTop";
import { HomeSections } from "@/components/HomeSections";
import { HeroDealCards } from "@/components/HeroDealCards";
import { GiftFloatingButton } from "@/components/GiftFloatingButton";
import { getPageSections } from "@/lib/page-sections";
import { getCatalogPage } from "@/lib/catalog";
import { isGiftProgramEnabled } from "@/lib/settings";

// Re-query the homepage at most once per 5 minutes (ISR) so it stays fast while
// reflecting admin changes reasonably quickly.
export const revalidate = 300;

export default async function Home() {
  // Sections come back render-ready (Decimals converted, catalog cards injected)
  // from the shared helper, scoped to the HOME placement so product/category/
  // checkout sections never leak onto the homepage.
  const { sections, stats } = await getPageSections("HOME");

  // The floating gift shortcut follows the programme's master switch: if the
  // giveaway has been stopped in /admin/settings, the homepage must not keep
  // advertising it. Same read the /gifts page itself gates on.
  const giftEnabled = await isGiftProgramEnabled();

  // Newest products for the laptop-only strip that overlaps the hero's bottom
  // edge. `total` decides whether the "Show more" button (→ /products) appears.
  const { products: latestProducts, total: latestTotal } = await getCatalogPage({
    sort: "newest",
  });

  // The hero's left panel is driven by the first VIDEO_CAROUSEL section; that
  // section is rendered in the hero, not again in the body.
  const heroVideoSection = sections.find((s) => s.type === "VIDEO_CAROUSEL");
  const bodySections = sections.filter((s) => s.id !== heroVideoSection?.id);

  const heroVideos = (heroVideoSection?.items || [])
    .filter((item) => item.videoUrl)
    .map((item) => ({
      id: item.id,
      src: item.videoUrl,
      name: item.title || "",
      label: item.subtitle || "",
      price: item.badge || "",
      // Mirror itemHref() in HomeSections: an explicit href wins, otherwise link
      // to the card's selected product so the "Link Product" dropdown works on
      // the hero too (not just the body sections).
      href:
        item.href ||
        (item.product?.slug ? `/products/${item.product.slug}` : "/products"),
    }));

  return (
    /* `relative isolate` makes <main> the positioning + stacking context for the
       hero video tint that HomeTop paints behind the navbar. */
    <main className="relative isolate min-h-screen bg-background text-foreground">
      {/* Navbar + hero. Grouped in one client component so the navbar can render
          transparent over the hero's video-colour gradient. */}
      <HomeTop videos={heroVideos} />

      {/* "New Arrivals" deal-style strip. Overlaps the hero's bottom edge on
          laptop; stacks two-up under it on phones. */}
      <HeroDealCards products={latestProducts} total={latestTotal} />

      {/* Everything below the hero is admin-managed via the Content Builder
          (/admin/home). Sections render in the order and with the content the
          admin configured; if none exist, only the hero is shown. */}
      <HomeSections sections={bodySections} stats={stats} />

      <SiteFooter />

      {/* Small draggable shortcut to /gifts, pinned to the viewport. Last in the
          tree so it is last in the tab order — it is a shortcut, not something
          to wade through on the way to the page. */}
      {giftEnabled ? <GiftFloatingButton /> : null}
    </main>
  );
}
