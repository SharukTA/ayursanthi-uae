import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { summarizeReviews } from "@/components/ProductCard";
import { parseRichText } from "@/components/RichText";
import { ProductPdfDocument } from "@/components/ProductPdfDocument";
import { fetchPdfImages } from "@/lib/pdf-images";

export const runtime = "nodejs";
// The PDF is built from live product data (price, stock-independent details) and
// remote images, so it must render per-request rather than being prerendered.
export const dynamic = "force-dynamic";

// GET /products/[slug]/pdf — streams a downloadable product-details PDF.
export async function GET(_request, { params }) {
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: { select: { name: true } },
      images: { orderBy: { sortOrder: "asc" } },
      attributes: { orderBy: { sortOrder: "asc" } },
      reviews: { select: { rating: true } },
    },
  });

  if (!product || !product.isActive) {
    return new Response("Product not found", { status: 404 });
  }

  const { rating, count } = summarizeReviews(product.reviews);

  // Only IMAGE media goes in the gallery (videos can't be embedded in a PDF).
  const galleryUrls = product.images
    .filter((m) => m.mediaType === "IMAGE")
    .map((m) => m.url);

  // Image URLs referenced inside the markdown description.
  const descImageUrls = parseRichText(product.description || "")
    .filter((b) => b.type === "images")
    .flatMap((b) => b.items.map((i) => i.url));

  const images = await fetchPdfImages([...galleryUrls, ...descImageUrls]);

  const buffer = await renderToBuffer(
    <ProductPdfDocument
      product={{
        name: product.name,
        category: product.category,
        sku: product.sku,
        price: Number(product.price),
        mrp: product.mrp ? Number(product.mrp) : null,
        offerLabel: product.offerLabel,
        netQuantity: product.netQuantity,
        keyIngredients: product.keyIngredients,
        shortDescription: product.shortDescription,
        description: product.description,
        attributes: product.attributes.map((a) => ({ label: a.label, value: a.value })),
        galleryUrls,
        rating,
        reviewCount: count,
      }}
      images={images}
    />
  );

  const filename = `${product.slug || "product"}-ayursanthi.pdf`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
