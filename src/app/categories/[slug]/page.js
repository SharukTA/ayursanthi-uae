import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArrowLeft } from "lucide-react";
import { PageReveal, Stagger, StaggerItem } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { ProductCard, summarizeReviews } from "@/components/ProductCard";
import { PageSections } from "@/components/HomeSections";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getPageSections } from "@/lib/page-sections";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
  });

  if (!category) {
    return { title: "Category Not Found" };
  }

  return {
    title: `${category.name} | Ayursanthi`,
    description: category.description,
  };
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
          images: {
            orderBy: { sortOrder: "asc" },
            take: 1,
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

  if (!category || !category.isActive) {
    notFound();
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
                    product={product}
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
