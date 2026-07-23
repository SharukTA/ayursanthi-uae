"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { FaceVideoCarousel } from "@/components/FaceVideoCarousel";

// `onDominantColor` bubbles the active video's colour up to <HomeTop/>, which
// owns the tinted backdrop. The tint is rendered there, not here, so it can
// extend up behind the transparent navbar to the top of the page — this section
// is `overflow-hidden` and starts below the nav.
export function HeroHome({ videos = [], onDominantColor }) {
  const reduceMotion = useReducedMotion();
  const ref = useRef(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", reduceMotion ? "0%" : "-12%"]);

  return (
    /* Transparent, not bg-white: the video tint is painted by <HomeTop/> on an
       element behind this section, so an opaque background here would hide it. */
    <section ref={ref} className="relative overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-4 pb-4 pt-2 sm:px-6 sm:pb-20 sm:pt-12 lg:px-8 lg:pb-6 lg:pt-8">
        {/* My Face product video carousel (admin-managed VIDEO_CAROUSEL). On lg
            it splits into a two-column hero (copy left, video-only carousel
            right); below lg it stays the centered single card it always was. */}
        <motion.div style={{ y }} className="relative mx-auto w-full max-w-4xl lg:max-w-none">
          <FaceVideoCarousel items={videos} onDominantColor={onDominantColor} heroLayout />
        </motion.div>
      </div>

    </section>
  );
}
