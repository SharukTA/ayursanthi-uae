"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { motion } from "motion/react";
import { ProductCard } from "@/components/ProductCard";

// The carousel behind every CMS product section (PRODUCT_CAROUSEL, BEST_SELLERS,
// RECENTLY_VIEWED).
//
// Cards are the same stacked card the "New Arrivals" strip and the /products
// grid use — photo on top, all text in a white block underneath — so the
// homepage reads as one system instead of switching card styles halfway down.
// The slide widths mirror New Arrivals' grid (two up on phones, four from lg),
// which also keeps a 4:5 photo plus its text block from running absurdly tall on
// a narrow screen.
export function FeaturedCarousel({ products = [] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", containScroll: "trimSnaps" },
    [Autoplay({ delay: 4200, stopOnInteraction: false, stopOnMouseEnter: true })]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState([]);
  const [canScroll, setCanScroll] = useState(false);

  const scrollTo = useCallback(
    (idx) => emblaApi?.scrollTo(idx),
    [emblaApi]
  );

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    const onReInit = () => {
      setScrollSnaps(emblaApi.scrollSnapList());
      setCanScroll(emblaApi.scrollSnapList().length > 1);
      onSelect();
    };
    onReInit();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onReInit);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onReInit);
    };
  }, [emblaApi]);

  return (
    <div className="relative">
      <div className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          {/* Gutters match New Arrivals' gap ladder (12 / 16 / 20px). */}
          <div className="flex -ml-3 sm:-ml-4 lg:-ml-5">
            {products.map((product, index) => (
            <motion.div
              key={product.id || product.slug || product.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: index * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-0 flex-[0_0_50%] pl-3 sm:flex-[0_0_33.333%] sm:pl-4 lg:flex-[0_0_25%] lg:pl-5"
            >
              <ProductCard
                product={product}
                // Sections built by the CMS carry `category: { name }`; catalog
                // callers carry a flat `categoryName`. Pass the flat one and let
                // ProductCard fall back, so both shapes label correctly.
                categoryName={product.categoryName}
                rating={product.rating}
                reviewCount={product.reviewCount}
                // The New Arrivals / catalog card: photo on top, text on white
                // underneath. The overlay layout drew the title and price across
                // the lower half of the photo, hiding the product itself.
                layout="stacked"
                // 4:5 matches the shape stills are uploaded in, so the photo sits
                // flush with both card edges instead of pillarboxing.
                aspect="aspect-[4/5]"
              />
            </motion.div>
          ))}
          </div>
        </div>
      </div>

      {/* Position dots below — only shown when there's more than one page. */}
      {canScroll ? (
        <div className="mt-6 flex items-center justify-center gap-2">
          {scrollSnaps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => scrollTo(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                idx === selectedIndex
                  ? "w-8 bg-[#232f3e] shadow-md"
                  : "w-3 bg-[#eaeded] hover:bg-[#565959]"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
