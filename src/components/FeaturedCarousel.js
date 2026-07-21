"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { motion } from "motion/react";
import { ProductCard } from "@/components/ProductCard";

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
          <div className="flex -ml-5">
            {products.map((product, index) => (
            <motion.div
              key={product.id || product.slug || product.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: index * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-0 flex-[0_0_70%] pl-5 sm:flex-[0_0_40%] lg:flex-[0_0_25%]"
            >
              <ProductCard
                product={product}
                rating={product.rating}
                reviewCount={product.reviewCount}
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
