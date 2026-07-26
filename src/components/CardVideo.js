"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

// A product video that costs nothing until the visitor shows intent.
//
// What it replaces: `<video src autoPlay loop muted preload="metadata" />`.
// That markup looks cheap because of `preload="metadata"`, but `autoPlay`
// overrides it — the browser MUST fetch the whole file to start playing, and
// `loop` keeps it re-buffering forever. Several of those on one grid meant a
// 25-50 MB page, which is how a month of Blob transfer went in a day.
//
// How this behaves instead:
//   • With a `poster` (a real still from the same product) → `preload="none"`,
//     so not one byte of video is requested until hover/tap. This is the path we
//     want, and the data layer supplies a still whenever the product has one.
//   • With no poster at all (video-only product) → `preload="metadata"` plus a
//     `#t=0.1` media fragment, which pulls just the header and one frame to paint
//     a thumbnail instead of an empty black box. Tens of KB, not tens of MB.
//     (Needs the moov atom up front — see the `-movflags +faststart` in the
//     ffmpeg recipe used to compress these files.)
//
// Playback starts on hover (desktop), focus (keyboard) or tap (touch). Because
// cards put a stretched <Link> above the media, pointer events never reach this
// element directly — so we listen on the nearest `[data-media-hover-root]`
// ancestor, which is the card shell that contains both the media and that link.
export function CardVideo({
  src,
  poster,
  className = "",
  // Rendered over the still to signal "this is a video" the way Amazon does.
  showBadge = true,
}) {
  const videoRef = useRef(null);
  // Once true we have committed to downloading the clip.
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // The card shell that also contains the stretched <Link>; fall back to the
    // video itself when this is used outside a card.
    const root = video.closest("[data-media-hover-root]") || video;

    const activate = () => setActivated(true);

    root.addEventListener("pointerenter", activate, { once: true });
    root.addEventListener("focusin", activate, { once: true });
    // Touch devices never fire pointerenter before a tap.
    root.addEventListener("touchstart", activate, { once: true, passive: true });

    return () => {
      root.removeEventListener("pointerenter", activate);
      root.removeEventListener("focusin", activate);
      root.removeEventListener("touchstart", activate);
    };
  }, []);

  // Kick off playback only after activation flips `preload`, so the request is
  // made on intent rather than on mount.
  useEffect(() => {
    if (!activated) return;
    const video = videoRef.current;
    if (!video) return;
    // Muted playback is always permitted; a rejected promise (reduced-motion or
    // a data-saver policy) just leaves the poster frame up, which is fine.
    video.play().catch(() => {});
  }, [activated]);

  return (
    <>
      <video
        ref={videoRef}
        // The fragment gives us a first frame to display when there is no poster
        // to fall back on. Dropped once activated so the full file can stream.
        src={activated || poster ? src : `${src}#t=0.1`}
        poster={poster || undefined}
        preload={activated ? "auto" : poster ? "none" : "metadata"}
        muted
        loop
        playsInline
        aria-hidden="true"
        className={className}
      />
      {showBadge && !activated ? (
        // Top-right: the card layouts all stack their own badges top-LEFT and
        // put text in a bottom scrim, so this corner is free in every one.
        <span className="pointer-events-none absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-[#0f1111]/70 backdrop-blur-sm">
          <Play className="size-3.5 text-[#ffffff]" fill="currentColor" />
        </span>
      ) : null}
    </>
  );
}
