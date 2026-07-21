"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { FaceVideoCarousel } from "@/components/FaceVideoCarousel";
import { GiftDrawBlock } from "@/components/GiftDrawBlock";
import { ScrollHint } from "@/components/ScrollHint";

// `onDominantColor` bubbles the active video's colour up to <HomeTop/>, which
// owns the tinted backdrop. The tint is rendered there, not here, so it can
// extend up behind the transparent navbar to the top of the page — this section
// is `overflow-hidden` and starts below the nav.
export function HeroHome({
  videos = [],
  teaserGifts = [],
  moreGifts = false,
  onDominantColor,
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const yLeft = useTransform(scrollYProgress, [0, 1], ["0%", reduceMotion ? "0%" : "-12%"]);
  const yRight = useTransform(scrollYProgress, [0, 1], ["0%", reduceMotion ? "0%" : "10%"]);

  return (
    /* Transparent, not bg-white: the video tint is painted by <HomeTop/> on an
       element behind this section, so an opaque background here would hide it. */
    <section ref={ref} className="relative overflow-hidden">
      <div className="relative mx-auto grid max-w-7xl items-center gap-5 px-4 pb-14 pt-2 sm:gap-12 sm:px-6 sm:pb-20 sm:pt-12 lg:grid-cols-[1.15fr_1fr] lg:items-stretch lg:gap-16 lg:px-8 lg:pb-6 lg:pt-8">
        {/* Left — My Face product video carousel (admin-managed VIDEO_CAROUSEL).
            Stretches to the row height on lg so the video card stands as tall as
            the gift block beside it instead of floating short at 16:9. */}
        <motion.div style={{ y: yLeft }} className="relative lg:h-full">
          <FaceVideoCarousel items={videos} onDominantColor={onDominantColor} />
        </motion.div>

        {/* Right — Gift-draw block (admin-managed milestone tiers). Fetches the
            visitor's own eligibility + wins client-side. */}
        <motion.div style={{ y: yRight }} className="relative flex items-center lg:items-start">
          <GiftDrawBlock teaserGifts={teaserGifts} moreGifts={moreGifts} />
        </motion.div>
      </div>

      {/* Bottom scroll hint — pinned to the right so it never overlaps the
          carousel/prize content and stays clearly visible. Hidden on mobile,
          where GiftDrawBlock renders the hint inline below the referral CTA. */}
      <div className="pointer-events-none absolute bottom-6 right-4 hidden sm:right-6 lg:right-8 lg:block">
        <ScrollHint />
      </div>
    </section>
  );
}
