"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ArrowRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";

// Pulls a vibrant "dominant" colour out of the current video frame by drawing it
// onto a tiny offscreen canvas and bucketing the pixels. Near-black, near-white
// and grey pixels are ignored so the result is the colour that defines the clip
// (skin/product tones), not the muddy average. Returns an "r, g, b" string or
// null when no frame is decodable yet (canvas not painted / video not loaded).
function getDominantColor(video) {
  try {
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement("canvas");
    const w = (canvas.width = 48);
    const h = (canvas.height = 48);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const buckets = new Map();
    let best = null;
    let bestCount = 0;
    let ar = 0, ag = 0, ab = 0, an = 0; // running average as a fallback

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 125) continue;
      ar += r; ag += g; ab += b; an++;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      // Skip near-black, near-white and low-saturation (grey) pixels.
      if (max < 32 || min > 224 || max - min < 24) continue;

      const key = ((r >> 5) << 10) | ((g >> 5) << 5) | (b >> 5);
      const next = (buckets.get(key) || 0) + 1;
      buckets.set(key, next);
      if (next > bestCount) {
        bestCount = next;
        best = [r, g, b];
      }
    }

    if (best) return `${best[0]}, ${best[1]}, ${best[2]}`;
    if (an) return `${Math.round(ar / an)}, ${Math.round(ag / an)}, ${Math.round(ab / an)}`;
    return null;
  } catch {
    // Tainted canvas (cross-origin video) or unsupported — fail silently.
    return null;
  }
}

// Video cards are driven by the admin-managed VIDEO_CAROUSEL home section. Each
// item carries: { src, name, price, label, href }. The component renders nothing
// if no videos were added, so the homepage stays clean until the admin adds some.
//
// `onDominantColor` (optional) is called with the "r, g, b" string of the active
// video's dominant colour whenever the visible slide changes — the hero uses it
// to tint the mobile backdrop, Amazon-style.
export function FaceVideoCarousel({ items = [], onDominantColor, heroLayout = false }) {
  const faceVideos = items;
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "center", containScroll: "trimSnaps" },
    [Autoplay({ delay: 5200, stopOnInteraction: false, stopOnMouseEnter: true })]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState([]);
  const [canScroll, setCanScroll] = useState(false);
  const videoRefs = useRef([]);
  const colorCacheRef = useRef({});
  const selectedIndexRef = useRef(0);

  const scrollTo = useCallback((idx) => emblaApi?.scrollTo(idx), [emblaApi]);

  // Sample a slide's video for its dominant colour. The frame isn't always ready
  // the moment a slide is selected (paused/just-loading videos), so retry a few
  // times. Only the currently-selected slide is allowed to drive the backdrop.
  const captureColor = useCallback(
    (index, attempt = 0) => {
      const video = videoRefs.current[index];
      if (!video) return;
      const color = colorCacheRef.current[index] || getDominantColor(video);
      if (color) {
        colorCacheRef.current[index] = color;
        if (index === selectedIndexRef.current) onDominantColor?.(color);
      } else if (attempt < 24) {
        window.setTimeout(() => captureColor(index, attempt + 1), 150);
      }
    },
    [onDominantColor]
  );

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap();
      selectedIndexRef.current = idx;
      setSelectedIndex(idx);
    };
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

  // Only let the visible slide's video play — keeps it lightweight — and refresh
  // the backdrop colour to match whichever video is now centre stage.
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
    videoRefs.current.forEach((video, idx) => {
      if (!video) return;
      if (idx === selectedIndex) {
        const play = video.play();
        if (play?.catch) play.catch(() => {});
      } else {
        video.pause();
      }
    });
    captureColor(selectedIndex);
  }, [selectedIndex, captureColor]);

  // No videos added by the admin yet — render nothing.
  if (faceVideos.length === 0) return null;

  // The slide currently centre-stage — drives the left copy panel in heroLayout
  // so the writing stays in sync as the carousel autoplays through the videos.
  const activeItem = faceVideos[selectedIndex] || faceVideos[0];

  return (
    /* On lg the whole carousel is a flex column that fills the hero row: the
       track takes the leftover height (min-h-0 so it can shrink) and the dots sit
       under it. Below lg the card keeps its 16:9 aspect and heights are natural.
       In `heroLayout` (homepage hero, lg only) it becomes a two-column row: the
       active video's copy on the left, the video-only carousel on the right. */
    <div
      className={`relative flex w-full flex-col lg:h-full ${
        heroLayout ? "lg:flex-row lg:items-center lg:gap-10" : ""
      }`}
    >
      {/* Left copy panel — homepage hero, laptop only. The card itself carries no
          text on lg (video only); every word lives here instead. */}
      {heroLayout ? (
        <div className="hidden min-w-0 lg:flex lg:w-[38%] lg:shrink-0 lg:flex-col lg:justify-center">
          {activeItem?.label ? (
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#565959]">
              {activeItem.label}
            </p>
          ) : null}
          {activeItem?.name ? (
            <h2 className="mt-3 text-4xl font-black leading-[1.1] text-[#0f1111]">
              {activeItem.name}
            </h2>
          ) : null}
          {activeItem?.price ? (
            <p className="mt-4 inline-flex items-center gap-1.5 text-2xl font-bold text-[#0f1111]">
              <Tag className="size-6 text-emerald-600" />
              {activeItem.price}
            </p>
          ) : null}
          <div className="mt-7">
            <Button
              asChild
              className="h-12 rounded-full bg-emerald-600 px-8 text-base text-white hover:bg-emerald-500"
            >
              <Link href={activeItem?.href || "/products"}>
                Shop now <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      {/* Carousel column */}
      <div
        className={`relative flex w-full flex-col lg:h-full ${
          heroLayout ? "lg:min-w-0 lg:flex-1" : ""
        }`}
      >
        <div className="relative lg:min-h-0 lg:flex-1">
        <div className="overflow-hidden rounded-2xl lg:h-full" ref={emblaRef}>
          <div className="flex lg:h-full">
            {faceVideos.map((item, index) => (
            <div
              key={item.id || item.src}
              className="min-w-0 flex-[0_0_72%] px-1.5 sm:flex-[0_0_100%] sm:px-0 lg:h-full"
            >
              <article
                /* Portrait on phones (Amazon-app style) — a 16:9 card at 72% of a
                   phone's width is only ~150px tall and the overlay swallows it.
                   16:9 returns at sm, and lg stretches to the hero row height. */
                className={`group relative aspect-[3/4] overflow-hidden rounded-2xl border border-black/15 bg-[#232f3e] shadow-2xl transition-[transform,opacity] duration-300 sm:aspect-video lg:aspect-auto lg:h-full lg:min-h-[460px] ${
                  index === selectedIndex
                    ? ""
                    : "scale-[0.94] opacity-70 sm:scale-100 sm:opacity-100"
                }`}
              >
                {/* Background video */}
                <video
                  ref={(el) => (videoRefs.current[index] = el)}
                  className="absolute inset-0 size-full object-cover"
                  src={item.src}
                  // Fetch as CORS so drawing the frame to a canvas doesn't taint
                  // it — required now that videos are served cross-origin from
                  // Vercel Blob, otherwise getDominantColor() can't read pixels.
                  crossOrigin="anonymous"
                  muted
                  loop
                  playsInline
                  // Only the slide on screen is allowed to fetch anything. Every
                  // slide used to preload metadata while slide 0 autoplayed in
                  // full, so a single homepage visit pulled the whole carousel
                  // out of Blob. The effect on `selectedIndex` below calls
                  // play()/pause(), which is what actually starts the download —
                  // so `autoPlay` here was redundant as well as expensive.
                  preload={index === selectedIndex ? "auto" : "none"}
                  aria-hidden="true"
                  onLoadedData={() => captureColor(index)}
                />
                {/* Readability gradient — on lg hero the card is video-only, so
                    the scrim (which only exists to carry the overlaid copy) is
                    dropped there. */}
                <div
                  className={`absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-black/10 ${
                    heroLayout ? "lg:hidden" : ""
                  }`}
                />

                {/* Price chip */}
                {item.price ? (
                  <span
                    className={`absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-sm font-bold text-[#0f1111] shadow-lg backdrop-blur ${
                      heroLayout ? "lg:hidden" : ""
                    }`}
                  >
                    <Tag className="size-4" />
                    {item.price}
                  </span>
                ) : null}

                {/* Product info overlay — hidden on the lg hero, where the copy
                    moves to the left panel and the card shows video only. */}
                <div
                  className={`absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-6 ${
                    heroLayout ? "lg:hidden" : ""
                  }`}
                >
                  <div>
                    {item.label ? (
                      <p className="text-xs font-bold uppercase tracking-wider text-white/70">
                        {item.label}
                      </p>
                    ) : null}
                    <h3 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                      {item.name}
                    </h3>
                    {item.price ? (
                      <p className="mt-1 text-lg font-bold text-[#ffa41c]">
                        {item.price}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    asChild
                    className="h-10 shrink-0 rounded-full bg-emerald-600 px-5 text-white hover:bg-emerald-500"
                  >
                    <Link href={item.href || "/products"}>
                      Shop <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </article>
            </div>
          ))}
          </div>
        </div>
      </div>

        {/* Position dots below — only shown when there's more than one video. */}
        {canScroll ? (
          <div className="mt-5 flex items-center justify-center gap-2">
            {scrollSnaps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => scrollTo(idx)}
                aria-label={`Go to video ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === selectedIndex
                    ? "w-8 bg-[#232f3e] shadow-md"
                    : "w-3 bg-[#232f3e]/30 hover:bg-[#232f3e]/60"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
