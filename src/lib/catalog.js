import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { summarizeReviews } from "@/components/ProductCard";

// How many catalog rows each page (initial server render + every "load more"
// fetch) returns. Kept small so the first paint is light and infinite scroll
// kicks in quickly even with a modest catalog.
export const PRODUCTS_PAGE_SIZE = 8;

// Filler words that carry no search intent. We strip these before building the
// full-text query so a phrase like "oils for sexual desire" searches for
// oil/sexual/desire and isn't dragged down (or broken) by "for". Postgres also
// drops stopwords internally, but removing them here keeps the generated
// tsquery clean (no dangling `|` around an empty stopword lexeme).
const SEARCH_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he",
  "in", "is", "it", "its", "of", "on", "or", "that", "the", "to", "was", "were",
  "will", "with", "my", "your", "our", "me", "i", "you", "this", "these",
  "those", "best", "good", "buy", "shop", "online",
]);

// Turn a raw search string into a Postgres `to_tsquery` expression, Amazon-style:
//   "oils for sexual desire"  ->  "oil:* | sexual:* | desir:*" (after stemming)
// Each meaningful word becomes a prefix term (`:*`, so "oil" matches "oils") and
// they're OR-ed so partial matches still surface — relevance ranking (ts_rank)
// then floats the products that hit the MOST terms, in the most important
// fields, to the top. Returns null when nothing searchable remains (e.g. the
// user typed only stopwords), so callers fall back to the plain listing.
export function buildTsQuery(search = "") {
  const tokens = String(search)
    .toLowerCase()
    // Keep letters/digits/spaces only — strips quotes, punctuation, and the
    // tsquery operators (& | ! :) so user input can never form a malformed or
    // injected query.
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !SEARCH_STOPWORDS.has(t));

  if (tokens.length === 0) return null;
  // Dedupe to avoid `oil:* | oil:*`, then OR the prefix terms together.
  return [...new Set(tokens)].map((t) => `${t}:*`).join(" | ");
}

// Normalize the raw facet inputs (which arrive as query strings from the URL or
// the /api/catalog fetch) into a clean, trusted shape: numbers or null for the
// range/threshold facets, real booleans for the toggles. Everything downstream
// (the SQL builder, the active-filter chips) reads this canonical form.
export function normalizeFilters({
  category = "",
  minPrice,
  maxPrice,
  minRating,
  minDiscount,
  inStock,
  featured,
} = {}) {
  const num = (v) => {
    if (v === "" || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const bool = (v) => v === true || v === "true" || v === "1";
  return {
    category: category || "",
    minPrice: num(minPrice),
    maxPrice: num(maxPrice),
    minRating: num(minRating),
    minDiscount: num(minDiscount),
    inStock: bool(inStock),
    featured: bool(featured),
  };
}

// Build the AND-clauses shared by both the plain listing and the ranked-search
// path, from the normalized facets. Every value is passed as a bound parameter
// (never interpolated), so this is injection-safe. Discount is computed from
// mrp vs price; customer rating is a correlated average over ProductReview so
// the "4★ & up" facet reflects real reviews, not a stored column.
function buildFilterSql(f) {
  const parts = [];
  if (f.category) parts.push(Prisma.sql`AND "Category".slug = ${f.category}`);
  if (f.minPrice != null) parts.push(Prisma.sql`AND "Product".price >= ${f.minPrice}`);
  if (f.maxPrice != null) parts.push(Prisma.sql`AND "Product".price <= ${f.maxPrice}`);
  if (f.inStock) parts.push(Prisma.sql`AND "Product".stock > 0`);
  if (f.featured) parts.push(Prisma.sql`AND "Product"."isFeatured" = true`);
  if (f.minDiscount != null) {
    parts.push(
      Prisma.sql`AND "Product".mrp IS NOT NULL AND "Product".mrp > 0 AND (("Product".mrp - "Product".price) / "Product".mrp * 100) >= ${f.minDiscount}`
    );
  }
  if (f.minRating != null) {
    parts.push(
      Prisma.sql`AND (SELECT COALESCE(AVG(r.rating), 0) FROM "ProductReview" r WHERE r."productId" = "Product".id) >= ${f.minRating}`
    );
  }
  return parts.length ? Prisma.join(parts, " ") : Prisma.empty;
}

// ORDER BY fragment for a given sort key. `query` is the compiled to_tsquery (or
// null): when present and no explicit sort is chosen, results fall back to
// relevance ranking; otherwise to newest-first. Discount/rating/popularity all
// sort by the same computed expressions the facets filter on.
function buildOrderSql(sort, query) {
  switch (sort) {
    case "price-asc":
      return Prisma.sql`"Product".price ASC`;
    case "price-desc":
      return Prisma.sql`"Product".price DESC`;
    case "discount":
      return Prisma.sql`(CASE WHEN "Product".mrp IS NULL OR "Product".mrp = 0 THEN 0 ELSE ("Product".mrp - "Product".price) / "Product".mrp END) DESC, "Product"."createdAt" DESC`;
    case "rating":
      return Prisma.sql`(SELECT COALESCE(AVG(r.rating), 0) FROM "ProductReview" r WHERE r."productId" = "Product".id) DESC, "Product"."createdAt" DESC`;
    case "popular":
      return Prisma.sql`(SELECT COUNT(*) FROM "ProductReview" r WHERE r."productId" = "Product".id) DESC, "Product"."createdAt" DESC`;
    case "newest":
    default:
      return query
        ? Prisma.sql`ts_rank("Product"."searchVector", ${query}) DESC, "Product"."createdAt" DESC`
        : Prisma.sql`"Product"."createdAt" DESC`;
  }
}

// Prisma returns Decimal for price/mrp and full relation rows; flatten to a
// plain, JSON-serializable shape so the same object can cross the server →
// client boundary (props) or the network (/api/catalog) unchanged. The card
// only needs the first image, the category name, and the aggregated rating.
export function serializeCatalogProduct(product) {
  const { rating, count } = summarizeReviews(product.reviews);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    description: product.description,
    price: Number(product.price),
    mrp: product.mrp != null ? Number(product.mrp) : null,
    offerLabel: product.offerLabel,
    stock: product.stock,
    isFeatured: product.isFeatured,
    // Carry mediaType alongside the URL: the card renders a real <video> for a
    // video primary, but a video URL silently fails as a CSS background-image,
    // so dropping mediaType here would make video-first products show blank.
    images: product.images?.[0]?.url
      ? [{ url: product.images[0].url, mediaType: product.images[0].mediaType }]
      : [],
    categoryName: product.category?.name ?? "",
    rating,
    reviewCount: count,
  };
}

// The include shape every catalog row needs: first image, category label, and
// the ratings used for the card star bar. Shared by both the plain-listing and
// ranked-search paths so cards render identically however they were fetched.
const CATALOG_INCLUDE = {
  category: { select: { name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1 },
  reviews: { select: { rating: true } },
};

// The single catalog query powering both the plain listing and full-text
// search, with the full facet set applied uniformly. The match + ordering run
// in Postgres (so paging and the total count stay consistent under every facet
// combination), then the page's rows are re-fetched through Prisma preserving
// that order so they serialize exactly like everywhere else. A non-null
// `tsquery` adds the relevance match on top of the facets.
async function queryCatalog({ tsquery, filters, sort, currentPage }) {
  const query = tsquery ? Prisma.sql`to_tsquery('english', ${tsquery})` : null;
  const offset = (currentPage - 1) * PRODUCTS_PAGE_SIZE;

  const searchClause = query ? Prisma.sql`AND "Product"."searchVector" @@ ${query}` : Prisma.empty;
  const filterClause = buildFilterSql(filters);
  const orderBy = buildOrderSql(sort, query);

  const matchClause = Prisma.sql`
    FROM "Product"
    LEFT JOIN "Category" ON "Category".id = "Product"."categoryId"
    WHERE "Product"."isActive" = true
      ${searchClause}
      ${filterClause}`;

  const [idRows, countRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT "Product".id ${matchClause}
      ORDER BY ${orderBy}
      LIMIT ${PRODUCTS_PAGE_SIZE} OFFSET ${offset}`,
    prisma.$queryRaw`SELECT count(*)::int AS count ${matchClause}`,
  ]);

  const ids = idRows.map((row) => row.id);
  const total = countRows[0]?.count ?? 0;

  // Pull the full rows for this page, then restore the DB order ($queryRaw
  // returned them ordered, but `findMany` with `id IN (...)` does not preserve it).
  const rows = ids.length
    ? await prisma.product.findMany({
        where: { id: { in: ids } },
        include: CATALOG_INCLUDE,
      })
    : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

  return {
    products: ordered.map(serializeCatalogProduct),
    total,
    page: currentPage,
    hasMore: currentPage * PRODUCTS_PAGE_SIZE < total,
  };
}

// One page of the catalog plus the totals the UI needs: `total` drives the
// "N results" summary and `hasMore` tells the infinite-scroll list whether to
// keep fetching. A non-empty `search` layers relevance ranking on top of the
// facets; every facet (price/rating/discount/stock/best-seller/category) is
// honoured in both cases.
export async function getCatalogPage({
  search = "",
  category = "",
  sort = "newest",
  page = 1,
  minPrice,
  maxPrice,
  minRating,
  minDiscount,
  inStock,
  featured,
} = {}) {
  const currentPage = Math.max(1, Number(page) || 1);
  const filters = normalizeFilters({
    category,
    minPrice,
    maxPrice,
    minRating,
    minDiscount,
    inStock,
    featured,
  });
  const tsquery = buildTsQuery(search);

  return queryCatalog({ tsquery, filters, sort, currentPage });
}
