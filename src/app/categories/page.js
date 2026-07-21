import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Stagger, StaggerItem } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Tilt3D } from "@/components/Tilt3D";

export const metadata = {
  title: "Categories Directory | Ayursanthi",
  description: "Browse ayurvedic products by specific category collections.",
};

export default async function CategoriesPage() {
  // Query all active categories with product counts
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      {/* Category Directory — Amazon-style circular icons: each category image
          fills a round shape with a soft brand ring/background, the name sits
          centered below, and the product count underneath. Many small icons per
          row instead of a few large cards. */}
      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 flex-1 w-full">
        <Stagger className="grid grid-cols-3 gap-x-4 gap-y-10 sm:grid-cols-4 lg:grid-cols-6">
          {categories.map((cat) => {
            const defaultImg = "https://images.pexels.com/photos/4871365/pexels-photo-4871365.jpeg?auto=compress&cs=tinysrgb&w=600";
            const imageUrl = cat.imageUrl || defaultImg;

            return (
              <StaggerItem key={cat.id}>
                <Tilt3D maxTilt={10} scale={1.05} className="h-full">
                  <Link
                    href={`/products?category=${cat.slug}`}
                    className="group flex flex-col items-center text-center"
                  >
                    <div className="relative aspect-square w-full max-w-33 overflow-hidden rounded-full bg-[#f7fafa] p-1.5 ring-1 ring-[#d5d9d9] shadow-sm transition duration-300 group-hover:shadow-xl group-hover:ring-[#adb1b8]">
                      <div
                        className="h-full w-full rounded-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                        style={{ backgroundImage: `url('${imageUrl}')` }}
                      />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-[#0f1111] group-hover:underline transition">
                      {cat.name}
                    </h3>
                    <p className="mt-0.5 text-xs font-semibold text-[#565959]">
                      {cat._count.products} products
                    </p>
                  </Link>
                </Tilt3D>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      <SiteFooter />
    </main>
  );
}
