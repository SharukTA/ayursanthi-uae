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
              select: { id: true, name: true, slug: true, price: true, mrp: true },
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

// Dynamic section types (CATEGORY_GRID, PRODUCT_CAROUSEL, REVIEWS) do NOT store
// their own items; the cards are pulled live — CATEGORY_GRID/PRODUCT_CAROUSEL
// from the catalog the admin manages (/admin/categories, /admin/products), and
// REVIEWS from real customer-submitted ProductReview rows. The admin creates the
// section + heading in the Content Builder, but never edits the cards.

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

// All active products, as PRODUCT_CAROUSEL items (featured first).
async function getProductItems() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        mrp: true,
        offerLabel: true,
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
      },
    });
    return products.map((p) => {
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
          stock: p.stock,
          isFeatured: p.isFeatured,
          category: p.category ? { name: p.category.name } : null,
          images: cardMedia,
          rating,
          reviewCount,
        },
      };
    });
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

  const [categoryItems, productItems, reviewItems] = await Promise.all([
    needsCategories ? getCategoryItems() : Promise.resolve([]),
    needsProducts ? getProductItems() : Promise.resolve([]),
    needsReviews ? getReviewItems() : Promise.resolve([]),
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
    return {
      ...section,
      items: section.items.map((item) => ({
        ...item,
        product: item.product
          ? {
              ...item.product,
              price: item.product.price != null ? Number(item.product.price) : null,
              mrp: item.product.mrp != null ? Number(item.product.mrp) : null,
            }
          : null,
      })),
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
