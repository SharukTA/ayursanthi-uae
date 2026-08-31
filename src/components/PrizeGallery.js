"use client";

import { useState } from "react";
import { Gift } from "lucide-react";

// A prize card that can show more than one photograph.
//
// A client component for exactly one reason: swapping the main image when a
// thumbnail is pressed. Everything else about the card is static, so the cost is
// one small bundle rather than making the whole gifts page interactive.
//
// Built image-first, because on a phone this card IS the advertisement. The
// picture takes a square — the largest shape that fits two-up without pushing
// the name off-screen — and the text underneath is deliberately small and tight
// so nothing competes with it. The thumbnail strip appears only when there IS
// more than one image; a single lone thumbnail under a picture reads as a
// broken carousel.

/**
 * The cover, or a placeholder that still reads as a prize.
 *
 * A prize starts life with an empty gallery, so a page that only looked right
 * once every upload was done would look broken for as long as that took. The
 * placeholder is deliberately quiet and holds exactly the same space, so filling
 * images in later changes nothing about the layout.
 */
function Placeholder() {
  return (
    <span
      className="flex aspect-square w-full items-center justify-center bg-slate-100 text-slate-300"
      aria-hidden="true"
    >
      <Gift className="size-10" />
    </span>
  );
}

/**
 * @param {object} props
 * @param {{name: string, valueNote?: string|null, quantity?: number|null, images: Array<{id: string, url: string}>}} props.prize
 */
export function PrizeGallery({ prize }) {
  const images = prize.images ?? [];
  const [activeIndex, setActiveIndex] = useState(0);

  // Guarded rather than trusted: the gallery is admin-managed and can shrink
  // between renders, and an index past the end would blank the card.
  const active = images[Math.min(activeIndex, Math.max(0, images.length - 1))];

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#d5d9d9] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative">
        {active ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={active.url}
            alt={prize.name}
            loading="lazy"
            className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <Placeholder />
        )}

        {/* Overlaid rather than placed in the text block: "3 to be won" is a
            claim about the picture, and on a phone the text block is only a
            couple of lines tall. */}
        {prize.quantity ? (
          <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-950 shadow">
            {prize.quantity} to be won
          </span>
        ) : null}

        {images.length > 1 ? (
          <span className="absolute bottom-2 right-2 rounded-full bg-slate-950/75 px-2 py-0.5 text-[10px] font-bold text-white">
            {images.length} photos
          </span>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="flex gap-1.5 overflow-x-auto px-2.5 pt-2.5">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`${prize.name}, photo ${index + 1} of ${images.length}`}
              aria-current={index === activeIndex}
              className={`size-9 shrink-0 overflow-hidden rounded border transition sm:size-11 ${
                index === activeIndex
                  ? "border-amber-400 ring-1 ring-amber-400"
                  : "border-[#d5d9d9] opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-auto px-2.5 py-2.5 sm:px-4 sm:py-3">
        <p className="line-clamp-2 text-[11px] font-bold leading-snug text-[#0f1111] sm:text-sm">
          {prize.name}
        </p>
        {prize.valueNote ? (
          <p className="mt-0.5 text-[10px] font-black text-[#067d62] sm:text-[11px]">
            {prize.valueNote}
          </p>
        ) : null}
      </div>
    </div>
  );
}
