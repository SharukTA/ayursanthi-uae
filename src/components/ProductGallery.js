"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ImageOff, Play, VideoOff, X } from "lucide-react";
import { ImageFill } from "@/components/ProductMedia";

// ─────────────────────────────────────────────────────────────────────────────
// Amazon/Flipkart-style product media gallery. Takes an ordered list of media
// items ({ url, altText, mediaType }) — images and videos mixed — and renders a
// large main viewer the buyer can swipe through, with a thumbnail strip that
// jumps to any item. Falls back to a single placeholder when there is no media.
//
// This mirrors Amazon's detail-page behaviour exactly, and it is the ONLY place
// on the site where a product video is meant to play:
//
//   • Grid/search/carousel cards show a still, never a clip (see pickCardMedia).
//   • Here, a video appears as a poster frame with a play badge.
//   • Playback happens in a lightbox, after a deliberate click — never on load.
//
// That ordering is what keeps video affordable: only a visitor who has already
// chosen a product and asked to watch ever downloads one.
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_IMAGE =
  "https://images.pexels.com/photos/4871365/pexels-photo-4871365.jpeg?auto=compress&cs=tinysrgb&w=900";

// Appended to a video URL so the browser decodes one frame for the poster
// instead of showing an empty black box. `preload="metadata"` alone is not
// enough — Chrome usually paints a frame, Safari often does not. Requires the
// moov atom up front, which `scripts/compress-videos.mjs` guarantees via
// `-movflags +faststart`.
const POSTER_FRAGMENT = "#t=0.1";

// Shown in place of media whose file cannot be loaded at all (deleted from
// storage, 404, offline). Rendering a neutral tile is deliberate: swapping in
// another remote image would just risk a second failure, and a broken-image icon
// reads to a customer as a broken shop.
function BrokenMedia({ kind, compact = false }) {
  const Icon = kind === "VIDEO" ? VideoOff : ImageOff;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[#f7fafa] text-[#565959]">
      <Icon className={compact ? "size-4" : "size-8"} />
      {!compact ? (
        <span className="text-[11px] font-semibold">
          {kind === "VIDEO" ? "Video unavailable" : "Image unavailable"}
        </span>
      ) : null}
    </div>
  );
}

export function ProductGallery({ media = [], productName = "" }) {
  const items =
    media.length > 0
      ? media
      : [{ url: FALLBACK_IMAGE, altText: productName, mediaType: "IMAGE" }];

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    containScroll: "trimSnaps",
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  // The video item currently expanded in the fullscreen lightbox, or null.
  const [modalVideo, setModalVideo] = useState(null);
  // Indices whose file failed to load, so we can show a placeholder instead of a
  // black box. A Set keyed by index — items are positional and never reordered
  // within a render.
  const [failed, setFailed] = useState(() => new Set());
  // True once the lightbox video itself fails, so the modal can say so rather
  // than sitting on an empty black rectangle.
  const [modalFailed, setModalFailed] = useState(false);
  const videoRefs = useRef([]);

  const scrollTo = useCallback((idx) => emblaApi?.scrollTo(idx), [emblaApi]);

  const markFailed = useCallback((index) => {
    setFailed((prev) => {
      if (prev.has(index)) return prev; // already known — don't re-render
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi]);

  // Pause any video that scrolls out of view so only the visible slide plays.
  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (video && idx !== selectedIndex) video.pause();
    });
  }, [selectedIndex]);

  // While the lightbox is open: close on Escape and lock background scroll.
  useEffect(() => {
    if (!modalVideo) return;
    const onKey = (e) => {
      if (e.key === "Escape") setModalVideo(null);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [modalVideo]);

  const openVideo = useCallback((item) => {
    setModalFailed(false);
    setModalVideo(item);
  }, []);

  const hasMany = items.length > 1;

  return (
    <div className="flex flex-col gap-3">
      {/* Main swipeable viewer */}
      <div className="relative">
        <div className="overflow-hidden rounded-md border border-border bg-white" ref={emblaRef}>
          <div className="flex">
            {items.map((item, index) => {
              const isVideo = item.mediaType === "VIDEO";
              const isBroken = failed.has(index);

              return (
                <div key={index} className="min-w-0 flex-[0_0_100%]">
                  <div
                    className={`relative flex aspect-square w-full items-center justify-center ${
                      isVideo && !isBroken ? "bg-black" : "bg-white"
                    }`}
                  >
                    {isBroken ? (
                      <BrokenMedia kind={item.mediaType} />
                    ) : isVideo ? (
                      <button
                        type="button"
                        onClick={() => openVideo(item)}
                        aria-label={`Play video${productName ? ` for ${productName}` : ""}`}
                        className="group absolute inset-0"
                      >
                        <video
                          ref={(el) => (videoRefs.current[index] = el)}
                          // Poster frame only. The full clip is fetched by the
                          // lightbox below, after the buyer asks for it.
                          src={`${item.url}${POSTER_FRAGMENT}`}
                          muted
                          playsInline
                          preload="metadata"
                          onError={() => markFailed(index)}
                          className="pointer-events-none size-full object-contain"
                        />
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="flex size-16 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/30 transition group-hover:bg-black/80">
                            <Play className="size-7 fill-white text-white" />
                          </span>
                        </span>
                      </button>
                    ) : (
                      <ImageFill
                        src={item.url}
                        alt={item.altText || productName}
                        // `contain`, not `cover`: a product photo that isn't
                        // square must never have its edges cropped in the main
                        // view — this is the shot the buyer is judging.
                        fit="contain"
                        // The detail page hard-caps this column at 360px on
                        // mobile and 500px above it, so asking for viewport
                        // widths would over-fetch on every large phone.
                        sizes="(max-width: 640px) 360px, 500px"
                        // The first slide is the page's largest contentful paint.
                        preload={index === 0}
                        onError={() => markFailed(index)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Thumbnail strip */}
      {hasMany ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {items.map((item, index) => {
            const isVideo = item.mediaType === "VIDEO";
            const isBroken = failed.has(index);

            return (
              <button
                key={index}
                type="button"
                onClick={() => (isVideo ? openVideo(item) : scrollTo(index))}
                disabled={isBroken}
                aria-label={`View ${isVideo ? "video" : "image"} ${index + 1}`}
                className={`relative size-16 shrink-0 overflow-hidden rounded border bg-white transition sm:size-20 ${
                  index === selectedIndex
                    ? "border-emerald-600 ring-2 ring-emerald-600/30"
                    : "border-slate-200 hover:border-slate-300"
                } ${isBroken ? "cursor-not-allowed opacity-60" : ""}`}
              >
                {isBroken ? (
                  <BrokenMedia kind={item.mediaType} compact />
                ) : isVideo ? (
                  <>
                    <video
                      src={`${item.url}${POSTER_FRAGMENT}`}
                      muted
                      playsInline
                      preload="metadata"
                      onError={() => markFailed(index)}
                      className="size-full object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play className="size-5 fill-white text-white" />
                    </span>
                  </>
                ) : (
                  <ImageFill
                    src={item.url}
                    alt={item.altText || `${productName} ${index + 1}`}
                    // Tops out at 80px (sm:size-20); quality 50 is invisible here.
                    sizes="80px"
                    quality={50}
                    onError={() => markFailed(index)}
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Fullscreen video lightbox. Clicking the backdrop (anywhere outside the
          video itself), pressing Escape, or hitting the close button dismisses
          it. The video stops propagation so its own controls stay usable.
          This is the ONE place a full video file is downloaded, and only after
          the buyer has clicked to watch it. */}
      {modalVideo ? (
        <div
          onClick={() => setModalVideo(null)}
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setModalVideo(null)}
            aria-label="Close video"
            className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/30 transition hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
          {modalFailed ? (
            // A codec the browser can't decode, or a file that has gone missing.
            // Without this the buyer stares at an empty black screen.
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center gap-2 rounded-md bg-white/10 px-6 py-8 text-center text-white ring-1 ring-white/20"
            >
              <VideoOff className="size-8" />
              <p className="text-sm font-semibold">This video couldn&apos;t be played.</p>
              <p className="text-xs text-white/70">Please try again later.</p>
            </div>
          ) : (
            <video
              src={modalVideo.url}
              controls
              autoPlay
              playsInline
              onError={() => setModalFailed(true)}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] w-auto max-w-[92vw] rounded-md"
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
