import { prisma } from "@/lib/prisma";
import { CARD_MEDIA_SELECT, CARD_MEDIA_TAKE, pickCardMedia } from "@/lib/media";

// ─────────────────────────────────────────────────────────────────────────────
// Shared CMS-section data layer.
//
// Every public page that renders admin-managed sections (home, product detail,
// category detail, checkout) goes through getPageSections(placement). It returns
// render-ready data so each page is a one-liner:
//
//   const { sections, stats } = await getPageSections("PRODUCT");
//   <HomeSections sections={sections} stats={stats} />
//
// Responsibilities centralised here (previously inline in src/app/page.js):
//   • query the active sections for a placement, ordered by position
//   • inject live catalog cards for the catalog-driven section types
//     (CATEGORY_GRID / PRODUCT_CAROUSEL) so they always mirror the portals
//   • convert Prisma Decimal fields to plain numbers (client-serialisable)
//   • compute live community stats, but only when a STATS_BAR is present
// ─────────────────────────────────────────────────────────────────────────────

// Active sections (with active items) for one placement, ordered for display.
async function getSections(placement) {
  try {
    return await prisma.homeSection.findMany({
      where: { isActive: true, placement },
      orderBy: { position: "asc" },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { position: "asc" },
          include: {
            product: {
              // `isActive` comes along only so serializeSections can drop the
              // link to a retired product; it never reaches the renderers.
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                mrp: true,
                isActive: true,
              },
            },
          },
        },
      },
    });
  } catch {
    return [];
  }
}

// Live community numbers powering STATS_BAR. The admin chooses which to show,
// never the numbers themselves (they are DB counts).
export async function getCommunityStats() {
  try {
    const [registeredCount, bookingsCount] = await Promise.all([
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.order.count({ where: { paymentStatus: "PAID" } }),
    ]);

    return {
      REGISTERED_CUSTOMERS: registeredCount,
      PAID_ORDERS: bookingsCount,
    };
  } catch {
    return { REGISTERED_CUSTOMERS: 0, PAID_ORDERS: 0 };
  }
}

// Dynamic section types (CATEGORY_GRID, PRODUCT_CAROUSEL, REVIEWS,
// BEST_SELLERS) do NOT store their own items; the cards are pulled live —
// CATEGORY_GRID/PRODUCT_CAROUSEL from the catalog the admin manages
// (/admin/categories, /admin/products), REVIEWS from real customer-submitted
// ProductReview rows, and BEST_SELLERS from actual paid sales. The admin creates
// the section + heading in the Content Builder, but never edits the cards.
//
// RECENTLY_VIEWED is dynamic too but personalised, so it is the one type with no
// server-side fetcher here — see components/RecentlyViewedSection.js.

// All active categories, as CATEGORY_GRID items.
async function getCategoryItems() {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, slug: true, description: true, imageUrl: true },
    });
    return categories.map((c) => ({
      id: c.id,
      title: c.name,
      subtitle: null,
      body: c.description || "",
      imageUrl: c.imageUrl || "",
      videoUrl: null,
      badge: null,
      href: `/products?category=${c.slug}`,
      product: null,
    }));
  } catch {
    return [];
  }
}

// Everything a product-carousel card needs. Shared by every section that
// renders ProductCards (PRODUCT_CAROUSEL, BEST_SELLERS) and by the
// /api/recently-viewed endpoint, so a card looks identical wherever it came from.
export const SECTION_PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  price: true,
  mrp: true,
  offerLabel: true,
  netQuantity: true,
  stock: true,
  isFeatured: true,
  category: { select: { name: true } },
  // Several rows, not one: `pickCardMedia` looks past a video sorted first
  // to find the still the card should show, so a deals/product carousel
  // never pulls a multi-MB clip to paint a thumbnail.
  images: {
    orderBy: { sortOrder: "asc" },
    take: CARD_MEDIA_TAKE,
    select: CARD_MEDIA_SELECT,
  },
  // Real customer ratings — averaged per product for the card star bar.
  reviews: { select: { rating: true } },
};

// A product row (selected with SECTION_PRODUCT_SELECT) → the generic section-item
// shape the renderers read. Decimals become plain numbers so the result can cross
// the server → client boundary untouched.
export function toProductItem(p) {
  const reviewCount = p.reviews.length;
  const rating = reviewCount
    ? p.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
    : 0;
  // One entry, still-preferred — the shape every card already reads.
  const cardMedia = pickCardMedia(p.images);
  return {
    id: p.id,
    title: null,
    subtitle: null,
    body: null,
    imageUrl: cardMedia[0]?.url || "",
    videoUrl: null,
    badge: null,
    href: `/products/${p.slug}`,
    product: {
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price != null ? Number(p.price) : null,
      mrp: p.mrp != null ? Number(p.mrp) : null,
      offerLabel: p.offerLabel || null,
      netQuantity: p.netQuantity || null,
      stock: p.stock,
      isFeatured: p.isFeatured,
      category: p.category ? { name: p.category.name } : null,
      images: cardMedia,
      rating,
      reviewCount,
    },
  };
}

// All active products, as PRODUCT_CAROUSEL items (featured first).
async function getProductItems() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      select: SECTION_PRODUCT_SELECT,
    });
    return products.map(toProductItem);
  } catch {
    return [];
  }
}

// How many cards a BEST_SELLERS block shows. The carousel pages through them, so
// this is a "deep enough to scroll, shallow enough to stay a highlight" number.
const BEST_SELLERS_LIMIT = 12;

// Top products by units actually sold, as BEST_SELLERS items.
//
// "Sold" means a line on an order whose payment landed — PAID only, so pending
// and failed checkouts can never inflate the ranking. Ranked by total units
// (summed quantity) rather than order count, matching what "best selling" means
// to a shopper.
//
// Deliberately NOT backfilled with featured/newest products when the store has
// no sales yet: an empty block renders nothing, whereas a padded one would put a
// "Best Sellers" heading over products nobody has bought.
async function getBestSellerItems() {
  try {
    const ranked = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: { paymentStatus: "PAID" },
        // Skip work on rows whose product is gone or hidden; the findMany below
        // filters again, but this keeps retired products out of the ranking so
        // they don't consume slots that live products should get.
        product: { isActive: true },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: BEST_SELLERS_LIMIT,
    });

    const ids = ranked.map((row) => row.productId);
    if (ids.length === 0) return [];

    const products = await prisma.product.findMany({
      where: { id: { in: ids }, isActive: true },
      select: SECTION_PRODUCT_SELECT,
    });

    // `findMany` with `id IN (...)` does not preserve order — restore the
    // sales ranking (same pattern as lib/catalog.js).
    const byId = new Map(products.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter(Boolean).map(toProductItem);
  } catch {
    return [];
  }
}

// Real customer reviews, as REVIEWS items. Like CATEGORY_GRID/PRODUCT_CAROUSEL,
// the REVIEWS block does NOT store its own items — the admin can never author a
// testimonial. We surface a "best of recent" slice: only 4★+ reviews with a
// written comment (so the marketing band never shows a negative or empty card),
// ordered newest-first so it stays fresh and rotates as customers post. Pulled
// straight from the ProductReview table — 100% genuine verified-buyer content.
async function getReviewItems() {
  try {
    const reviews = await prisma.productReview.findMany({
      where: { rating: { gte: 4 }, comment: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 9,
      include: {
        user: { select: { name: true } },
        product: {
          select: {
            name: true,
            slug: true,
            images: {
              orderBy: { sortOrder: "asc" },
              take: CARD_MEDIA_TAKE,
              select: CARD_MEDIA_SELECT,
            },
          },
        },
      },
    });
    return reviews.map((r) => {
      // Still-preferred: this thumbnail renders at 36-48px, so pulling a video
      // for it was the single most wasteful request on the home page.
      const cardMedia = pickCardMedia(r.product?.images);
      return {
        id: r.id,
        title: r.user?.name || "Verified buyer",
        subtitle: null,
        body: r.comment,
        // The reviewed product's primary media — shown as the card thumbnail. A
        // video-only product needs a real <video>, so carry the type through.
        imageUrl: cardMedia[0]?.url || "",
        imageMediaType: cardMedia[0]?.mediaType || null,
        videoUrl: null,
        badge: null,
        href: r.product?.slug ? `/products/${r.product.slug}` : null,
        product: null,
        // Extra fields the ReviewsSection renderer uses for real reviews.
        rating: r.rating,
        productName: r.product?.name || null,
      };
    });
  } catch {
    return [];
  }
}

// Replace catalog-driven sections' items with the live catalog, and convert
// Decimal product fields to plain numbers everywhere else. Catalog items are
// fetched lazily (only when such a section exists) to avoid needless queries.
async function serializeSections(sections) {
  const needsCategories = sections.some((s) => s.type === "CATEGORY_GRID");
  const needsProducts = sections.some((s) => s.type === "PRODUCT_CAROUSEL");
  const needsReviews = sections.some((s) => s.type === "REVIEWS");
  const needsBestSellers = sections.some((s) => s.type === "BEST_SELLERS");

  const [categoryItems, productItems, reviewItems, bestSellerItems] = await Promise.all([
    needsCategories ? getCategoryItems() : Promise.resolve([]),
    needsProducts ? getProductItems() : Promise.resolve([]),
    needsReviews ? getReviewItems() : Promise.resolve([]),
    needsBestSellers ? getBestSellerItems() : Promise.resolve([]),
  ]);

  return sections.map((section) => {
    if (section.type === "CATEGORY_GRID") {
      return { ...section, items: categoryItems };
    }
    if (section.type === "PRODUCT_CAROUSEL") {
      return { ...section, items: productItems };
    }
    if (section.type === "REVIEWS") {
      return { ...section, items: reviewItems };
    }
    if (section.type === "BEST_SELLERS") {
      return { ...section, items: bestSellerItems };
    }
    // RECENTLY_VIEWED is personalised, so it has no server-side items at all —
    // the client renderer assembles it from the visitor's own browser history.
    // It falls through to the generic branch below and stays empty.
    return {
      ...section,
      items: section.items.map((item) => {
        // A product the admin deleted is only soft-deleted (isActive = false),
        // so the row — and this item's link to it — survives. Left attached, the
        // card would keep pointing at /products/<slug>, which now 404s. Treating
        // it as unlinked makes the renderers fall back to /products, exactly as
        // they do for an item that was never linked to a product at all.
        // (Dynamic sections never hit this: they re-query the catalog with
        // `isActive: true`, so a retired product simply stops appearing.)
        const product = item.product?.isActive ? item.product : null;
        return {
          ...item,
          product: product
            ? {
                id: product.id,
                name: product.name,
                slug: product.slug,
                price: product.price != null ? Number(product.price) : null,
                mrp: product.mrp != null ? Number(product.mrp) : null,
              }
            : null,
        };
      }),
    };
  });
}

// Public entry point: render-ready sections + stats for a given placement.
export async function getPageSections(placement) {
  const rawSections = await getSections(placement);
  const sections = await serializeSections(rawSections);

  // Stats are only needed by STATS_BAR blocks; skip the queries otherwise.
  const hasStatsBar = sections.some((s) => s.type === "STATS_BAR");
  const stats = hasStatsBar ? await getCommunityStats() : {};

  return { sections, stats };
}
