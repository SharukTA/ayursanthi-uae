import Link from "next/link";
import { FadeIn, Stagger, StaggerItem } from "@/components/Animated";
import { Tilt3D } from "@/components/Tilt3D";

// Categories created by the admin (queried from the database) shown right under
// the "Deals just for you" section. Explicit #0f1111 ink text is used so the
// copy stays readable on the white page background (the global palette remaps
// light text utilities to ink).

const DEFAULT_IMAGE =
  "https://images.pexels.com/photos/4871365/pexels-photo-4871365.jpeg?auto=compress&cs=tinysrgb&w=600";

export function CategoryShowcase({ categories = [] }) {
  // Nothing to show if the admin hasn't added any active categories yet.
  if (categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <FadeIn className="text-center">
        <p className="text-sm font-bold uppercase tracking-wider text-[#565959]">
          Explore our range
        </p>
        <h2 className="mt-2 text-3xl font-bold text-[#0f1111] sm:text-4xl">
          Shop by category
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[#565959]">
          Browse the wellness collections curated by our team.
        </p>
      </FadeIn>

      {/* Amazon-style circular category icons: the product image fills a round
          shape with a soft brand ring/background, and the name sits centered
          below. Many small icons per row instead of a few large cards. */}
      <Stagger className="mt-10 grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
        {categories.map((cat) => {
          const imageUrl = cat.imageUrl || DEFAULT_IMAGE;

          return (
            <StaggerItem key={cat.id}>
              <Tilt3D maxTilt={8} scale={1.05} className="h-full">
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
                  <h3 className="mt-3 text-sm font-bold text-[#0f1111] group-hover:underline">
                    {cat.name}
                  </h3>
                </Link>
              </Tilt3D>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
