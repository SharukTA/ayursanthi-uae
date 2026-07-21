"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

// ─────────────────────────────────────────────────────────────────────────────
// SectionCarousel — a generic Embla carousel used by the image-bearing homepage
// blocks (DEAL_GRID, CATEGORY_GRID, PROMO_ADS). Each child is one slide; the
// caller controls slide width via `slideClassName` (responsive flex-basis) so a
// section can show 2, 3 or 4 cards at a time. Controls (dots + teal arrows)
// mirror FeaturedCarousel / FaceVideoCarousel so the homepage stays consistent.
//
// When there are too few items to scroll, Embla won't move; we hide the controls
// in that case so the row reads as a plain grid-like display.
// ─────────────────────────────────────────────────────────────────────────────
export function SectionCarousel({ children, slideClassName = "", autoplay = true }) {
  const slides = Array.isArray(children) ? children.filter(Boolean) : [children];

  const plugins = autoplay
    ? [Autoplay({ delay: 4500, stopOnInteraction: false, stopOnMouseEnter: true })]
    : [];
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", containScroll: "trimSnaps" },
    plugins
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState([]);
  const [canScroll, setCanScroll] = useState(false);

  const scrollTo = useCallback((idx) => emblaApi?.scrollTo(idx), [emblaApi]);

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
          <div className="flex -ml-4">
            {slides.map((slide, index) => (
              <div
                key={index}
                className={`min-w-0 pl-4 ${slideClassName}`}
              >
                {slide}
              </div>
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
