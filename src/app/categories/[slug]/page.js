import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArrowLeft } from "lucide-react";
import { PageReveal, Stagger, StaggerItem } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { ProductCard, summarizeReviews } from "@/components/ProductCard";
import { CARD_MEDIA_TAKE, pickCardMedia } from "@/lib/media";
import { PageSections } from "@/components/HomeSections";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getPageSections } from "@/lib/page-sections";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
  });

  if (!category || !category.isActive) {
    return { title: "Collection Not Available | Ayursanthi" };
  }

  return {
    title: `${category.name} | Ayursanthi`,
    description: category.description,
  };
}

// Fallback view for a collection URL that no longer resolves — the category was
// deleted or switched off after the link was created. Deliberately a normal page
// (header, footer, live suggestions) rather than notFound(): the shopper should
// land somewhere they can keep shopping from.
async function MissingCategory({ slug }) {
  // Whatever collections DO exist right now, so the page is never a dead end.
  // Wrapped because a store with no categories at all is a perfectly valid state.
  let alternatives = [];
  try {
    alternatives = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, name: true, slug: true },
    });
  } catch {
    alternatives = [];
  }

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 flex-1 w-full">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Categories", href: "/categories" },
            { label: "Not available" },
          ]}
        />

        <div className="rounded-md border border-dashed border-border bg-white p-10 text-center">
          <h1 className="text-xl font-bold text-[#0f1111] sm:text-2xl">
            This collection is no longer available
          </h1>
          <p className="mt-3 text-sm text-[#565959]">
            The collection you followed{" "}
            <span className="font-semibold text-[#0f1111]">“{slug}”</span> has been
            removed. Its products are still in the store — browse the full catalog
            or pick another collection below.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="h-10 rounded-md bg-emerald-700 px-5 text-xs hover:bg-emerald-800">
              <Link href="/products">Browse All Products</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-md border-border px-5 text-xs text-[#0f1111]"
            >
              <Link href="/categories">All Collections</Link>
            </Button>
          </div>

          {alternatives.length > 0 ? (
            <div className="mt-8 border-t border-slate-100 pt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-[#565959]">
                Other collections
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {alternatives.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/products?category=${cat.slug}`}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

export default async function CategoryDetailPage({ params }) {
  const { slug } = await params;

  // Query category and its active products
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      products: {
        where: { isActive: true },
        include: {
          // Enough rows for `pickCardMedia` to find a still — a category grid
          // must never pull a multi-MB clip to paint a thumbnail.
          images: {
            orderBy: { sortOrder: "asc" },
            take: CARD_MEDIA_TAKE,
          },
          // Real customer ratings — averaged per product for the card star bar.
          reviews: {
            select: { rating: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // A deleted (or deactivated) collection is a dead link, not a broken site: an
  // old bookmark, a shared URL or a stale search result must not land the
  // shopper on a 404. Show the store's own "collection is gone" panel with a way
  // straight back into the catalog instead.
  if (!category || !category.isActive) {
    return <MissingCategory slug={slug} />;
  }

  // Admin-managed CMS sections shown above the product grid on every category
  // page (global per page-type). The product grid below always renders.
  const { sections: pageSections, stats: pageStats } = await getPageSections("CATEGORY");

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      {/* Header Banner */}
      <section className="relative overflow-hidden bg-slate-950 py-10 text-white sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PageReveal className="max-w-2xl">
            <Link 
              href="/categories" 
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white mb-3"
            >
              <ArrowLeft className="size-3" />
              All Collections
            </Link>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {category.name}
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              {category.description || `Browse our selections in the ${category.name} collection.`}
            </p>
          </PageReveal>
        </div>
      </section>

      {/* Category Products grid */}
      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 flex-1 w-full">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Categories", href: "/categories" },
            { label: category.name },
          ]}
        />

        {category.products.length === 0 ? (
          <div className="text-center py-20 rounded-md border border-dashed border-border bg-white">
            <p className="text-sm text-slate-500 font-semibold">No products are currently in this collection.</p>
            <Button asChild className="mt-4 bg-emerald-700 hover:bg-emerald-800 rounded-md text-xs h-9 px-4">
              <Link href="/products">Browse All Products</Link>
            </Button>
          </div>
        ) : (
          <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {category.products.map((product) => {
              const { rating, count } = summarizeReviews(product.reviews);

              return (
                <StaggerItem key={product.id} className="h-full">
                  <ProductCard
                    product={{ ...product, images: pickCardMedia(product.images) }}
                    categoryName={category.name}
                    rating={rating}
                    reviewCount={count}
                  />
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </section>

      {/* Admin-managed CMS band (Content Builder → Category pages), appended
          BELOW the standard product grid. Wrapped in the dark page palette so
          section styles render as designed in the builder. Renders nothing when
          the admin has configured no category-page sections. */}
      {pageSections.length > 0 ? (
        <div className="bg-background text-foreground">
          <PageSections sections={pageSections} stats={pageStats} />
        </div>
      ) : null}

      <SiteFooter />
    </main>
  );
}
