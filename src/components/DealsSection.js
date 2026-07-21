import Link from "next/link";
import { FadeIn, Stagger, StaggerItem } from "@/components/Animated";
import { ShopNowButton } from "@/components/ShopNowButton";

// Amazon-app style "deal" cards — ONE card per item. A bold deal title sits on
// top of each card, the product image fills the tile, and a CTA points to
// /products. Explicit #0f1111 ink text is used so it stays readable on the white
// page background (the global palette remaps light text utilities to ink).
const deals = [
  {
    title: "Deals on desires",
    name: "Kamakalpa Nabhi Oil",
    badge: "Up to 40% off",
    src: "/KAMAKALPA%20NABHI%20OIL.png",
    href: "/products",
  },
  {
    title: "Deals on desires",
    name: "Kamakalpa Special",
    badge: "Min. 25% off",
    src: "/Kamakalpa%20item%201.jpeg",
    href: "/products",
  },
  {
    title: "Deals on face glow",
    name: "My Face Glow",
    badge: "Up to 50% off",
    src: "/My%20face%20item.jpeg",
    href: "/products",
  },
  {
    title: "Deals on face glow",
    name: "My Face Care",
    badge: "Min. 30% off",
    src: "/My%20face%20item%201.jpeg",
    href: "/products",
  },
];

export function DealsSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <FadeIn>
        <p className="text-sm font-bold uppercase tracking-wider text-[#565959]">
          Today&apos;s offers
        </p>
        <h2 className="mt-2 text-3xl font-bold text-[#0f1111] sm:text-4xl">
          Deals just for you
        </h2>
        <p className="mt-3 max-w-xl text-sm text-[#565959]">
          Limited-time savings on our most-loved Kamakalpa and My Face picks.
        </p>
      </FadeIn>

      <Stagger className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {deals.map((deal) => (
          <StaggerItem key={deal.name}>
            {/* Container + stretched link rather than one big <Link>, so the
                "Shop now" CTA can be a real <button>. See ProductCard. */}
            <div className="group relative block h-full">
              <Link
                href={deal.href}
                className="absolute inset-0 z-10 rounded-xl"
                aria-label={deal.name}
              />
              <div className="flex h-full flex-col rounded-xl border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-2xl">
                {/* Deal title — sits on top, Amazon style */}
                <h3 className="text-base font-bold text-[#0f1111]">
                  {deal.title}
                </h3>

                {/* Product image tile */}
                <div className="mt-3 aspect-square overflow-hidden rounded-lg border border-slate-100 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={deal.src}
                    alt={deal.name}
                    loading="lazy"
                    className="size-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* Discount + name */}
                <div className="mt-3">
                  <span className="inline-block rounded bg-[#e11d48] px-1.5 py-0.5 text-[11px] font-bold text-[#ffffff]">
                    {deal.badge}
                  </span>
                  <p className="mt-1.5 truncate text-sm font-semibold text-[#0f1111]">
                    {deal.name}
                  </p>
                </div>

                {/* CTA */}
                <ShopNowButton href={deal.href} className="mt-3 self-start" />
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
