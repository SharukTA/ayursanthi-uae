"use client";

import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { HeroHome } from "@/components/HeroHome";

// Owns the homepage's "video tint" backdrop — the wash of the active carousel
// video's dominant colour that runs from the very top of the page (behind the
// transparent navbar) down through the hero, fading out into the white page.
//
// The backdrop deliberately lives HERE rather than inside <HeroHome/>: the hero
// section is `overflow-hidden` and starts below the navbar, so a tint rendered
// inside it can never paint behind the nav. Header and hero are still emitted as
// plain siblings of <main> (not wrapped in a positioned div) because wrapping
// them would make the sticky header stick only within that wrapper and scroll
// away with the hero.
//
// The tint is sized to cover header + hero. It can't just use `inset-0`: its
// parent is <main>, which spans the whole page, so it's measured instead.
export function HomeTop({ videos = [], teaserGifts = [], moreGifts = false }) {
  // Dominant colour of the active hero video ("r, g, b"); null until the first
  // frame is sampled.
  const [heroColor, setHeroColor] = useState(null);
  const [tintHeight, setTintHeight] = useState(null);
  const heroRef = useRef(null);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    // offsetTop is measured against <main> (the nearest positioned ancestor), so
    // this covers the navbar above the hero as well as the hero itself.
    const measure = () => setTintHeight(el.offsetTop + el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const tintStyle = {
    height: tintHeight ? `${tintHeight}px` : "70vh",
  };

  return (
    <>
      {/* Static wash fallback so the top of the page isn't plain white before the
          first video frame is sampled (heroColor still null). Uses an inline
          rgba gradient rather than Tailwind opacity utilities so it isn't caught
          by the global colour remap in globals.css. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10"
        style={{
          ...tintStyle,
          background:
            "radial-gradient(120% 120% at 50% 0%, rgba(19,25,33,0.10) 0%, rgba(19,25,33,0.04) 38%, rgba(255,255,255,0) 70%)",
        }}
      />

      {/* The live tint. The solid colour is faded out toward the bottom with a
          mask so it reads as a top-to-bottom gradient (strong at the very top of
          the page → page white below), like the Amazon app. backgroundColor (not
          the gradient) is animated so the tint eases as the active video
          changes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 transition-[background-color] duration-700 ease-out"
        style={
          heroColor
            ? {
                ...tintStyle,
                backgroundColor: `rgb(${heroColor})`,
                WebkitMaskImage:
                  "linear-gradient(to bottom, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.75) 30%, rgba(0,0,0,0.4) 55%, transparent 85%)",
                maskImage:
                  "linear-gradient(to bottom, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.75) 30%, rgba(0,0,0,0.4) 55%, transparent 85%)",
              }
            : tintStyle
        }
      />

      <SiteHeader transparent />

      <div ref={heroRef}>
        <HeroHome
          videos={videos}
          teaserGifts={teaserGifts}
          moreGifts={moreGifts}
          onDominantColor={setHeroColor}
        />
      </div>
    </>
  );
}
