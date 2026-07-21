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

// Shared filter clause for the *non-search* listing paths (category browse, the
// plain "all products" grid). Search has its own ranked path — see
// getCatalogPage / searchCatalogRanked — so this no longer handles `search`.
export function buildCatalogWhere({ category = "" } = {}) {
  return {
    isActive: true,
    ...(category ? { category: { slug: category } } : {}),
  };
}

function buildCatalogOrderBy(sort) {
  if (sort === "price-asc") return { price: "asc" };
  if (sort === "price-desc") return { price: "desc" };
  return { createdAt: "desc" };
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

// Relevance-ranked, full-text search page (the "Amazon search" path). Runs the
// match + ranking in Postgres against the generated `searchVector` so paging and
// the total count stay consistent, then re-fetches the page's products through
// Prisma (preserving rank order) so they serialize exactly like the plain
// listing. Sort defaults to relevance; price sorts are still honoured within the
// matched set.
async function searchCatalogRanked({ tsquery, category, sort, currentPage }) {
  const query = Prisma.sql`to_tsquery('english', ${tsquery})`;
  const categoryFilter = category
    ? Prisma.sql`AND "Category".slug = ${category}`
    : Prisma.empty;
  const offset = (currentPage - 1) * PRODUCTS_PAGE_SIZE;

  // Relevance is the default sort; price sorts re-order the matched set instead.
  const orderBy =
    sort === "price-asc"
      ? Prisma.sql`"Product".price ASC`
      : sort === "price-desc"
        ? Prisma.sql`"Product".price DESC`
        : Prisma.sql`ts_rank("Product"."searchVector", ${query}) DESC, "Product"."createdAt" DESC`;

  const matchClause = Prisma.sql`
    FROM "Product"
    LEFT JOIN "Category" ON "Category".id = "Product"."categoryId"
    WHERE "Product"."isActive" = true
      AND "Product"."searchVector" @@ ${query}
      ${categoryFilter}`;

  const [idRows, countRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT "Product".id ${matchClause}
      ORDER BY ${orderBy}
      LIMIT ${PRODUCTS_PAGE_SIZE} OFFSET ${offset}`,
    prisma.$queryRaw`SELECT count(*)::int AS count ${matchClause}`,
  ]);

  const ids = idRows.map((row) => row.id);
  const total = countRows[0]?.count ?? 0;

  // Pull the full rows for this page, then restore the ranked order ($queryRaw
  // returned them ranked, but `findMany` with `id IN (...)` does not preserve it).
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
// keep fetching. A non-empty `search` routes to the ranked full-text path;
// otherwise it's the plain (optionally category-filtered) listing.
export async function getCatalogPage({
  search = "",
  category = "",
  sort = "newest",
  page = 1,
} = {}) {
  const currentPage = Math.max(1, Number(page) || 1);

  const tsquery = buildTsQuery(search);
  if (tsquery) {
    return searchCatalogRanked({ tsquery, category, sort, currentPage });
  }

  const where = buildCatalogWhere({ category });

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: CATALOG_INCLUDE,
      orderBy: buildCatalogOrderBy(sort),
      skip: (currentPage - 1) * PRODUCTS_PAGE_SIZE,
      take: PRODUCTS_PAGE_SIZE,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: rows.map(serializeCatalogProduct),
    total,
    page: currentPage,
    hasMore: currentPage * PRODUCTS_PAGE_SIZE < total,
  };
}
