import { getCatalogPage } from "@/lib/catalog";

export const runtime = "nodejs";

// Paginated catalog feed for the products page's infinite scroll. The first
// page is rendered server-side in app/products/page.js; this endpoint serves
// every subsequent page (?page=2, 3, …) using the exact same filter/sort logic.
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const data = await getCatalogPage({
    search: searchParams.get("search") || "",
    category: searchParams.get("category") || "",
    sort: searchParams.get("sort") || "newest",
    page: searchParams.get("page") || 1,
    // Facet filters (Amazon/Flipkart-style). Absent params normalize to "no
    // filter", so the endpoint keeps working for callers that omit them.
    minPrice: searchParams.get("minPrice"),
    maxPrice: searchParams.get("maxPrice"),
    minRating: searchParams.get("minRating"),
    minDiscount: searchParams.get("minDiscount"),
    inStock: searchParams.get("inStock"),
    featured: searchParams.get("featured"),
  });

  return Response.json(data);
}
