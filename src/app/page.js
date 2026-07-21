import { prisma } from "@/lib/prisma";
import { SiteFooter } from "@/components/SiteFooter";
import { HomeTop } from "@/components/HomeTop";
import { HomeSections } from "@/components/HomeSections";
import { RewardFloatingButton } from "@/components/RewardFloatingButton";
import { getPageSections } from "@/lib/page-sections";

// Re-query the homepage at most once per 5 minutes (ISR) so it stays fast while
// reflecting admin changes reasonably quickly.
export const revalidate = 300;

// A few example gifts for the homepage gift-block teaser ("Win a Smart Watch,
// Phone…") — NOT the full catalogue. Pulled from the active gift tiers' lines
// (preferring ones with an image), de-duplicated by gift name. Public,
// non-personalised data, so it's safe to bake into the cached homepage.
const TEASER_LIMIT = 4;
async function getTeaserGifts() {
  try {
    const items = await prisma.giftTierItem.findMany({
      where: { tier: { isActive: true } },
      orderBy: [{ imageUrl: { sort: "desc", nulls: "last" } }, { createdAt: "asc" }],
      select: { name: true, imageUrl: true },
      take: 40,
    });
    const seen = new Set();
    const unique = [];
    for (const it of items) {
      const key = it.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({ name: it.name, imageUrl: it.imageUrl });
    }
    return {
      gifts: unique.slice(0, TEASER_LIMIT),
      more: unique.length > TEASER_LIMIT,
    };
  } catch {
    return { gifts: [], more: false };
  }
}

export default async function Home() {
  // Sections come back render-ready (Decimals converted, catalog cards injected)
  // from the shared helper, scoped to the HOME placement so product/category/
  // checkout sections never leak onto the homepage.
  const [{ sections, stats }, giftTeaser] = await Promise.all([
    getPageSections("HOME"),
    getTeaserGifts(),
  ]);

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
      <HomeTop
        videos={heroVideos}
        teaserGifts={giftTeaser.gifts}
        moreGifts={giftTeaser.more}
      />

      {/* Draggable shortcut to the gift/reward block above. Visible while that
          section is scrolled out of view, hidden once it's on screen. */}
      <RewardFloatingButton label="Rewards" />

      {/* Everything below the hero is admin-managed via the Content Builder
          (/admin/home). Sections render in the order and with the content the
          admin configured; if none exist, only the hero is shown. */}
      <HomeSections sections={bodySections} stats={stats} />

      <SiteFooter />
    </main>
  );
}
