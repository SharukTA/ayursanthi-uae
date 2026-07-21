import { Sparkles } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/Animated";
import { Tilt3D } from "@/components/Tilt3D";

const ads = [
  {
    image: "/KAMAKALPA%20NABHI%20OIL.png",
    title: "Kamakalpa Nabhi Oil",
    text: "Traditional ayurvedic navel oil for daily wellness.",
    fit: "object-contain",
  },
  {
    image: "/my%20face%20poster%201.jpg.jpeg",
    title: "Now Available",
    text: "Discover our newly launched featured range.",
    fit: "object-cover",
  },
];

export function PromoAds() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <FadeIn>
        <p className="text-sm font-bold uppercase tracking-wider text-emerald-200">
          Featured products
        </p>
        <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
          Spotlight
        </h2>
      </FadeIn>

      <Stagger className="mt-8 grid gap-6 sm:grid-cols-2">
        {ads.map((ad) => (
          <StaggerItem key={ad.title}>
            <Tilt3D maxTilt={8} scale={1.02} className="h-full">
              <div className="group flex h-full flex-col overflow-hidden rounded-md border border-border bg-white shadow-sm transition hover:shadow-2xl">
                <div className="relative flex h-64 items-center justify-center bg-slate-100">
                  <img
                    src={ad.image}
                    alt={ad.title}
                    className={`h-full w-full ${ad.fit} transition-transform duration-300 group-hover:scale-[1.04]`}
                  />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">
                    <Sparkles className="size-3" />
                    Featured
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-lg font-bold text-[#0f1111]">{ad.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#3f4545]">
                    {ad.text}
                  </p>
                </div>
              </div>
            </Tilt3D>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
