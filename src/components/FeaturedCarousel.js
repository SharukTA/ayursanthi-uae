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
// which also keeps the photo plus its text block from running absurdly tall on
// a narrow screen.
export function FeaturedCarousel({ products = [] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", containScroll: "trimSnaps" },
    [Autoplay({ delay: 4200, stopOnInteraction: false, stopOnMouseEnter: true })]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState([]);
  // Optimistic until Embla measures — see SectionCarousel for why: it drives the
  // "centre a row that isn't full" class below, and guessing `true` keeps a full
  // row from painting centred for a frame.
  const [canScroll, setCanScroll] = useState(products.length > 1);

  // A section holding exactly one product gets a wider slide. At the normal
  // widths (half a phone screen, a quarter of a laptop) a lone centred card
  // looks like a mistake — a stamp floating in white space. Solo, it takes the
  // DEAL_GRID card's phone/tablet widths (80% / 45%, see HomeSections) and goes
  // a step wider than it on laptops, so the section still reads as content.
  // Two or more products keep the row ladder untouched.
  const solo = products.length === 1;
  const slideWidth = solo
    ? "flex-[0_0_80%] sm:flex-[0_0_45%] lg:flex-[0_0_33.333%]"
    : "flex-[0_0_50%] sm:flex-[0_0_33.333%] lg:flex-[0_0_25%]";

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
          {/* Gutters match New Arrivals' gap ladder (12 / 16 / 20px). Too few
              cards to fill the row (a store with one product, a section pinned
              to two) centres instead of hugging the left margin — Embla parks a
              non-scrollable track at offset 0, so the CSS position stands. */}
          <div
            className={`flex -ml-3 sm:-ml-4 lg:-ml-5 ${canScroll ? "" : "justify-center"}`}
          >
            {products.map((product, index) => (
            <motion.div
              key={product.id || product.slug || product.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: index * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className={`min-w-0 pl-3 sm:pl-4 lg:pl-5 ${slideWidth}`}
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
                // Square rather than the 4:5 stills are uploaded in: it takes a
                // fifth off the card's height, which was the whole reason these
                // rows ran tall.
                aspect="aspect-square"
                // …and the photo fills that square instead of being fitted
                // inside it, so there are no blank bands down the sides. A 4:5
                // upload gives up 10% off the top and 10% off the bottom, which
                // is the margin around a centred product, not the product. Do
                // not widen `aspect` past square without revisiting this — the
                // crop grows fast and starts clipping tall bottles.
                mediaFit="cover"
                // Must track `slideWidth` above — the default assumes the
                // multi-card ladder and would fetch a photo half the width the
                // solo card actually paints at.
                sizes={
                  solo
                    ? "(max-width: 640px) 80vw, (max-width: 1024px) 45vw, 33vw"
                    : undefined
                }
              />
            </motion.div>
          ))}
          </div>
        </div>
      </div>

      {/* Position dots below — only shown when there's more than one page.
          Read off the measured snaps so nothing is reserved pre-init. */}
      {scrollSnaps.length > 1 ? (
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
