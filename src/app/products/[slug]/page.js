import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ShieldCheck, Leaf, Box, Download } from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ProductActions } from "@/components/ProductActions";
import { ProductGallery } from "@/components/ProductGallery";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DeliveryEstimator } from "@/components/DeliveryEstimator";
import { OffersBox } from "@/components/OffersBox";
import { AnimatedHeading, AnimatedReveal } from "@/components/AnimatedText";
import { ProductCard, RatingStars, summarizeReviews } from "@/components/ProductCard";
import { ReviewForm } from "@/components/ReviewForm";
import { ProductReviews } from "@/components/ProductReviews";
import { ProductDescription, AboutThisItem } from "@/components/ProductDescription";
import { PageSections } from "@/components/HomeSections";
import { RecentlyViewedTracker } from "@/components/RecentlyViewedTracker";
import { getPageSections } from "@/lib/page-sections";
import { CARD_MEDIA_TAKE, pickCardMedia } from "@/lib/media";
import { splitIngredients } from "@/lib/utils";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug },
  });

  if (!product) {
    return { title: "Product Not Found" };
  }

  return {
    title: `${product.name} | Ayursanthi`,
    description: product.shortDescription,
  };
}

export default async function ProductDetailPage({ params }) {
  const { slug } = await params;

  // Query product details from database
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      images: {
        orderBy: { sortOrder: "asc" },
      },
      attributes: {
        orderBy: { sortOrder: "asc" },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true } },
        },
      },
    },
  });

  if (!product || !product.isActive) {
    notFound();
  }

  // Aggregate of the product's real customer reviews, shown next to the title.
  const { rating: avgRating, count: reviewCount } = summarizeReviews(product.reviews);

  // Stored as one comma-separated string; rendered as individual pills.
  const ingredients = splitIngredients(product.keyIngredients);

  // Determine what the current viewer can do in the review form below:
  //  - isLoggedIn  : show the form vs. a sign-in prompt
  //  - canReview   : verified buyer (has a PAID order with this product)
  //  - existingReview: their own review, so the form prefills/updates instead
  //                    of creating a duplicate (one review per user per product)
  const session = await getSession();
  let canReview = false;
  let existingReview = null;
  if (session) {
    const purchased = await prisma.orderItem.findFirst({
      where: {
        productId: product.id,
        order: { userId: session.userId, paymentStatus: "PAID" },
      },
      select: { id: true },
    });
    canReview = Boolean(purchased);
    existingReview =
      product.reviews.find((rev) => rev.userId === session.userId) || null;
  }

  // Query related products from same category (excluding current product)
  const relatedProducts = await prisma.product.findMany({
    where: {
      categoryId: product.categoryId,
      id: { not: product.id },
      isActive: true,
    },
    take: 3,
    include: {
      category: { select: { name: true } },
      // Related products render as ProductCards, so pull enough rows for
      // `pickCardMedia` to find a still rather than handing a card a video.
      images: {
        orderBy: { sortOrder: "asc" },
        take: CARD_MEDIA_TAKE,
      },
      reviews: {
        select: { rating: true },
      },
    },
  });

  // Admin-managed CMS sections shown on every product page (a fixed slot below
  // the hardcoded buy-box). Global per page-type — same on all product pages.
  const { sections: pageSections, stats: pageStats } = await getPageSections("PRODUCT");

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      {/* Records this view in the visitor's own browser so a "Continue shopping"
          (RECENTLY_VIEWED) block can offer the product back to them later.
          Renders nothing; nothing is stored server-side. */}
      <RecentlyViewedTracker productId={product.id} />
      <SiteHeader />

      {/* Product Detail Grid */}
      <section className="mx-auto max-w-7xl px-4 py-4 sm:py-6 sm:px-6 lg:px-8 flex-1 w-full">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: product.category.name, href: `/products?category=${product.category.slug}` },
            { label: product.name },
          ]}
        />

        <div className="grid gap-6 sm:gap-10 lg:grid-cols-2">
          
          {/* Left Column: Swipeable media gallery (images + videos) */}
          <PageReveal className="flex flex-col justify-start">
            <div className="mx-auto w-full max-w-[360px] sm:max-w-[500px] lg:mx-0">
              <ProductGallery
                media={product.images.map((img) => ({
                  url: img.url,
                  altText: img.altText,
                  mediaType: img.mediaType,
                }))}
                productName={product.name}
              />
            </div>
          </PageReveal>

          {/* Right Column: Descriptions & Actions */}
          <FadeIn className="flex flex-col">
            <div>
              <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-800">
                {product.category.name}
              </span>
              <AnimatedHeading
                as="h1"
                text={product.name}
                className="mt-4 text-2xl font-bold tracking-tight text-[#0f1111] sm:text-3xl lg:text-4xl"
              />
              {/* Rating summary — averaged from real customer reviews below */}
              <a href="#reviews" className="mt-3 inline-flex items-center gap-2">
                {reviewCount > 0 ? (
                  <span className="text-sm font-bold text-[#0f1111]">
                    {avgRating.toFixed(1)}
                  </span>
                ) : null}
                <RatingStars rating={avgRating} />
                <span className="text-xs font-medium text-[#565959] hover:underline">
                  {reviewCount > 0
                    ? `${reviewCount.toLocaleString("en-IN")} rating${reviewCount > 1 ? "s" : ""}`
                    : "No ratings yet"}
                </span>
              </a>
              {/* Pack size sits right under the title, the way Amazon prints
                  "Size: 250 g" — it is what separates two otherwise identical
                  listings of the same item. */}
              {product.netQuantity ? (
                <p className="mt-2 text-sm font-semibold text-[#0f1111]">
                  Net Quantity:{" "}
                  <span className="font-bold">{product.netQuantity}</span>
                </p>
              ) : null}
              <p className="mt-2 text-xs font-medium text-[#565959]">
                SKU: <span className="font-mono">{product.sku}</span>
              </p>
            </div>

            {/* Price Frame */}
            <div className="mt-5 rounded-md bg-white border border-emerald-100 p-4 flex items-baseline gap-3">
              <span className="text-2xl font-extrabold text-emerald-800">
                Rs. {Number(product.price).toLocaleString()}
              </span>
              {product.mrp && (
                <span className="text-sm text-[#565959] line-through">
                  Rs. {Number(product.mrp).toLocaleString()}
                </span>
              )}
              {/* Discount badge: prefer the admin-entered "Offer Badge"
                  (product.offerLabel); fall back to the percentage computed
                  from MRP vs. price when no badge text was provided. */}
              {(product.offerLabel?.trim() || product.mrp) && (
                <span className="text-xs font-bold text-amber-800 bg-amber-100 rounded px-1.5 py-0.5">
                  {product.offerLabel?.trim()
                    ? product.offerLabel.trim()
                    : `${Math.round(((Number(product.mrp) - Number(product.price)) / Number(product.mrp)) * 100)}% OFF`}
                </span>
              )}
            </div>
            {/* Amazon shows a tax-inclusive price, so prices never grow at
                checkout — the GST is already inside this number. */}
            <p className="mt-1.5 text-xs font-medium text-[#565959]">
              Inclusive of all taxes
            </p>

            {/* Short description */}
            <p className="mt-6 text-sm leading-6 text-[#3f4545]">
              {product.shortDescription}
            </p>

            {/* About this item — Amazon-style bullet summary of the key selling
                points, pulled from the description's bullet lists. */}
            <AboutThisItem body={product.description} />

            {/* Available offers — derived from the product's real discount /
                badge plus the site-wide COD & dispatch promises. */}
            <OffersBox
              price={Number(product.price)}
              mrp={product.mrp != null ? Number(product.mrp) : null}
              offerLabel={product.offerLabel}
            />

            {/* Actions (Quantity and Checkout). The PDF href is passed through so
                the sticky action bar can show a Download button beside them. */}
            <ProductActions
              product={{
                ...product,
                price: Number(product.price),
                mrp: product.mrp ? Number(product.mrp) : null,
                shippingFee: Number(product.shippingFee ?? 0),
              }}
              pdfHref={`/products/${product.slug}/pdf`}
            />

            {/* Download the full product sheet (details, images, rating, specs &
                description) as a server-generated PDF. */}
            <a
              href={`/products/${product.slug}/pdf`}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-md border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              <Download className="size-4" />
              Download details as PDF
            </a>

            {/* Delivery estimator — pincode → estimated window + COD/returns. */}
            <DeliveryEstimator />

            {/* Value Badges */}
            <div className="mt-8 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <Leaf className="size-4 text-[#0f1111]" />
                <span className="text-xs font-bold text-[#0f1111]">100% Organic</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-[#0f1111]" />
                <span className="text-xs font-bold text-[#0f1111]">Lab Tested</span>
              </div>
              <div className="flex items-center gap-2">
                <Box className="size-4 text-[#0f1111]" />
                <span className="text-xs font-bold text-[#0f1111]">Secure Dispatch</span>
              </div>
            </div>
          </FadeIn>
        </div>

        {/* Key ingredients — its own section above the spec table, mirroring the
            way Amazon surfaces ingredients for consumables rather than burying
            them in technical details. */}
        {ingredients.length > 0 && (
          <div className="mt-10 border-t border-border pt-8 sm:mt-14 sm:pt-10">
            <AnimatedHeading
              as="h2"
              text="Key Ingredients"
              className="text-xl font-bold text-[#0f1111]"
              highlightWords={["Ingredients"]}
              highlightClassName=""
            />
            <ul className="mt-6 flex flex-wrap gap-2">
              {ingredients.map((ingredient) => (
                <li
                  key={ingredient}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-900"
                >
                  <Leaf className="size-3.5 shrink-0" />
                  {ingredient}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Specifications table (admin-managed key/value rows) */}
        {product.attributes.length > 0 && (
          <div className="mt-10 border-t border-border pt-8 sm:mt-14 sm:pt-10">
            <AnimatedHeading
              as="h2"
              text="Product Specifications"
              className="text-xl font-bold text-[#0f1111]"
              highlightWords={["Specifications"]}
              highlightClassName=""
            />
            <div className="mt-6 overflow-hidden rounded-md border border-border bg-white">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100">
                  {product.attributes.map((attr) => (
                    <tr key={attr.id} className="align-top">
                      <th className="w-2/5 bg-slate-50 px-4 py-3 font-semibold text-slate-600 sm:w-1/3">
                        {attr.label}
                      </th>
                      <td className="px-4 py-3 text-slate-800">{attr.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detailed Long Description */}
        <div className="mt-10 border-t border-border pt-8 sm:mt-14 sm:pt-10">
          <AnimatedHeading
            as="h2"
            text="Product Description"
            className="text-xl font-bold text-[#0f1111]"
            highlightWords={["Description"]}
            highlightClassName=""
          />
          <AnimatedReveal delay={0.2}>
            <ProductDescription body={product.description} />
          </AnimatedReveal>
        </div>

        {/* Related Products Grid */}
        {relatedProducts.length > 0 && (
          <div className="mt-10 border-t border-border pt-8 sm:mt-14 sm:pt-10">
            <AnimatedHeading
              as="h2"
              text="Related Products"
              className="text-xl font-bold text-[#0f1111]"
              highlightWords={["Products"]}
              highlightClassName=""
            />
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedProducts.map((rel) => {
                const { rating, count } = summarizeReviews(rel.reviews);
                return (
                  <ProductCard
                    key={rel.id}
                    // Still-preferred thumbnail; the raw row is ordered by
                    // sortOrder and may lead with a video.
                    product={{ ...rel, images: pickCardMedia(rel.images) }}
                    categoryName={rel.category?.name}
                    rating={rating}
                    reviewCount={count}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Reviews Panel */}
        <div id="reviews" className="mt-10 scroll-mt-24 border-t border-border pt-8 sm:mt-14 sm:pt-10">
          <AnimatedHeading
            as="h2"
            text="Customer Reviews"
            className="text-xl font-bold text-[#0f1111]"
            highlightWords={["Reviews"]}
            highlightClassName=""
          />
          {/* Customer submission form (verified buyers only) */}
          <ReviewForm
            slug={product.slug}
            isLoggedIn={Boolean(session)}
            canReview={canReview}
            existingReview={
              existingReview
                ? { rating: existingReview.rating, comment: existingReview.comment }
                : null
            }
          />

          <ProductReviews
            reviews={product.reviews.map((rev) => ({
              id: rev.id,
              userName: rev.user.name,
              rating: rev.rating,
              comment: rev.comment,
              createdAt: rev.createdAt.toISOString(),
            }))}
          />
        </div>
      </section>

      {/* Admin-managed CMS band (Content Builder → Product pages). A fixed slot:
          the buy-box, description and reviews above are hardcoded; only this band
          is admin-controlled. Wrapped in the dark page palette so the section
          styles render exactly as designed in the builder. Renders nothing when
          the admin has configured no product-page sections. */}
      {pageSections.length > 0 ? (
        <div className="bg-background text-foreground">
          <PageSections sections={pageSections} stats={pageStats} />
        </div>
      ) : null}

      <SiteFooter />
    </main>
  );
}
