"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Play, X } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Amazon/Flipkart-style product media gallery. Takes an ordered list of media
// items ({ url, altText, mediaType }) — images and videos mixed — and renders a
// large main viewer the buyer can swipe through, with a thumbnail strip that
// jumps to any item. Videos play inline with native controls. Falls back to a
// single placeholder image when the product has no media.
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_IMAGE =
  "https://images.pexels.com/photos/4871365/pexels-photo-4871365.jpeg?auto=compress&cs=tinysrgb&w=900";

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
  const videoRefs = useRef([]);

  const scrollTo = useCallback((idx) => emblaApi?.scrollTo(idx), [emblaApi]);

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

  const hasMany = items.length > 1;

  return (
    <div className="flex flex-col gap-3">
      {/* Main swipeable viewer */}
      <div className="relative">
        <div className="overflow-hidden rounded-md border border-border bg-white" ref={emblaRef}>
          <div className="flex">
            {items.map((item, index) => (
              <div key={index} className="min-w-0 flex-[0_0_100%]">
                <div
                  className={`relative flex aspect-square w-full items-center justify-center ${
                    item.mediaType === "VIDEO" ? "bg-black" : "bg-white"
                  }`}
                >
                  {item.mediaType === "VIDEO" ? (
                    <button
                      type="button"
                      onClick={() => setModalVideo(item)}
                      aria-label="Play video"
                      className="group relative h-full w-full"
                    >
                      <video
                        ref={(el) => (videoRefs.current[index] = el)}
                        src={item.url}
                        muted
                        playsInline
                        preload="metadata"
                        className="pointer-events-none h-full w-full object-contain"
                      />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex size-16 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/30 transition group-hover:bg-black/80">
                          <Play className="size-7 fill-white text-white" />
                        </span>
                      </span>
                    </button>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt={item.altText || productName}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Thumbnail strip */}
      {hasMany ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={() =>
                item.mediaType === "VIDEO" ? setModalVideo(item) : scrollTo(index)
              }
              aria-label={`View ${item.mediaType === "VIDEO" ? "video" : "image"} ${index + 1}`}
              className={`relative size-16 shrink-0 overflow-hidden rounded border bg-white transition sm:size-20 ${
                index === selectedIndex
                  ? "border-emerald-600 ring-2 ring-emerald-600/30"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {item.mediaType === "VIDEO" ? (
                <>
                  <video
                    src={item.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="size-5 fill-white text-white" />
                  </span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={item.altText || `${productName} ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      ) : null}

      {/* Fullscreen video lightbox. Clicking the backdrop (anywhere outside the
          video itself), pressing Escape, or hitting the close button dismisses
          it. The video stops propagation so its own controls stay usable. */}
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
          <video
            src={modalVideo.url}
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-auto max-w-[92vw] rounded-md"
          />
        </div>
      ) : null}
    </div>
  );
}
