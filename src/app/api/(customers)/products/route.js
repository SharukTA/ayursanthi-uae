import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildTsQuery } from "@/lib/catalog";

export const runtime = "nodejs";

const PRODUCT_INCLUDE = {
  category: true,
  images: { orderBy: { sortOrder: "asc" } },
};

// Relevance-ranked, full-text search (same engine as the storefront catalog —
// see lib/catalog.js). Returns full product rows in rank order. Honours the same
// categoryId / featured filters and price sorts as the plain listing below.
async function rankedSearch({ tsquery, categoryId, featured, sort }) {
  const query = Prisma.sql`to_tsquery('english', ${tsquery})`;
  const filters = Prisma.join(
    [
      Prisma.sql`"Product"."isActive" = true`,
      Prisma.sql`"Product"."searchVector" @@ ${query}`,
      ...(categoryId ? [Prisma.sql`"Product"."categoryId" = ${categoryId}`] : []),
      ...(featured === "true" ? [Prisma.sql`"Product"."isFeatured" = true`] : []),
    ],
    " AND "
  );
  const orderBy =
    sort === "price-low"
      ? Prisma.sql`"Product".price ASC`
      : sort === "price-high"
        ? Prisma.sql`"Product".price DESC`
        : Prisma.sql`ts_rank("Product"."searchVector", ${query}) DESC, "Product"."createdAt" DESC`;

  const idRows = await prisma.$queryRaw`
    SELECT "Product".id FROM "Product"
    WHERE ${filters}
    ORDER BY ${orderBy}`;
  const ids = idRows.map((row) => row.id);
  if (!ids.length) return [];

  // Re-fetch full rows, then restore the ranked order (`id IN (...)` doesn't keep it).
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: PRODUCT_INCLUDE,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search");
  const categoryId = searchParams.get("categoryId");
  const featured = searchParams.get("featured");
  const sort = searchParams.get("sort");

  // A real search term routes to the ranked full-text path; a blank/stopword-only
  // term falls through to the plain listing below.
  const tsquery = search ? buildTsQuery(search) : null;
  if (tsquery) {
    const products = await rankedSearch({ tsquery, categoryId, featured, sort });
    return Response.json({ products });
  }

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(categoryId ? { categoryId } : {}),
      ...(featured === "true" ? { isFeatured: true } : {}),
    },
    orderBy:
      sort === "price-low"
        ? { price: "asc" }
        : sort === "price-high"
          ? { price: "desc" }
          : { createdAt: "desc" },
    include: PRODUCT_INCLUDE,
  });

  return Response.json({ products });
}
