"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

/**
 * Amazon's order progress bar: a row of nodes joined by a track that fills up to
 * whichever step the order has reached.
 *
 * The fulfilment ladder in lib/returns.js has six rungs, but a shopper does not
 * distinguish "placed" from "accepted", so PENDING and CONFIRMED collapse into a
 * single "Ordered" node — the same fold Amazon makes. Every rung after that gets
 * its own node, so each admin transition visibly moves the bar.
 *
 * Only two of those rungs are timestamped in the schema (Order.createdAt and
 * Order.deliveredAt), so only those two nodes carry a date. The middle ones show
 * their label alone rather than inventing a time we do not actually know.
 */

const STEPS = [
  { key: "ORDERED", label: "Ordered", matches: ["PENDING", "CONFIRMED"] },
  { key: "PACKED", label: "Packed", matches: ["PROCESSING"] },
  { key: "SHIPPED", label: "Shipped", matches: ["SHIPPED"] },
  { key: "OUT", label: "Out for delivery", matches: ["OUT_FOR_DELIVERY"] },
  { key: "DELIVERED", label: "Delivered", matches: ["DELIVERED"] },
];

// Half a column: the track runs from the centre of the first node to the centre
// of the last, so it is inset by this much at each end.
const EDGE = 100 / (STEPS.length * 2);
const SPAN = 100 - EDGE * 2;

const fmtShort = (value) =>
  new Date(value).toLocaleDateString("en-AE", { day: "numeric", month: "short" });

export function OrderProgress({ order }) {
  // A cancelled order never finishes the ladder, and drawing a half-filled bar
  // next to "Cancelled" reads as though it is still coming. The page already
  // shows a dedicated cancellation panel, so this renders nothing.
  const cancelled = order.status === "CANCELLED";

  const currentIndex = STEPS.findIndex((step) => step.matches.includes(order.status));

  // Animate the fill in from zero on mount, the way Amazon's bar sweeps to its
  // position when the page settles. Starting at the final width would make the
  // bar appear static.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    // Deferred to the next frame on purpose: setting it synchronously here would
    // batch into the mount render and the bar would paint already full.
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (cancelled || currentIndex < 0) return null;

  const dates = {
    ORDERED: order.createdAt,
    DELIVERED: order.deliveredAt,
  };

  const progress = currentIndex / (STEPS.length - 1);

  return (
    <div className="mt-3">
      {/* The bar itself is decorative — every step is announced in the list
          below it, so screen readers get the state without parsing geometry. */}
      <div className="relative pb-1" aria-hidden="true">
        {/* Unfilled track */}
        <div
          className="absolute top-2.75 h-0.75 rounded-full bg-[#e3e6e6]"
          style={{ left: `${EDGE}%`, width: `${SPAN}%` }}
        />
        {/* Filled portion, up to the current node */}
        <div
          className="absolute top-2.75 h-0.75 rounded-full bg-[#067d62] transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ left: `${EDGE}%`, width: `${(grown ? progress : 0) * SPAN}%` }}
        />

        <div className="relative flex">
          {STEPS.map((step, index) => {
            const done = index < currentIndex;
            const current = index === currentIndex;
            return (
              <div
                key={step.key}
                className="flex flex-1 flex-col items-center gap-1.5 text-center"
              >
                <span
                  className={`flex size-5.75 items-center justify-center rounded-full border-2 transition-colors duration-500 motion-reduce:transition-none ${
                    done || current
                      ? "border-[#067d62] bg-[#067d62]"
                      : "border-[#d5d9d9] bg-[#ffffff]"
                  }`}
                >
                  {done ? (
                    // Arbitrary hex, not text-white: globals.css forces
                    // text-white to a dark ink, which would vanish on green.
                    <Check className="size-3 text-[#ffffff]" strokeWidth={3.5} />
                  ) : current ? (
                    <span className="size-1.75 rounded-full bg-[#ffffff]" />
                  ) : null}
                </span>
                <span
                  className={`px-0.5 text-[10px] leading-tight sm:text-[11px] ${
                    done || current ? "font-bold text-[#0f1111]" : "text-[#565959]"
                  }`}
                >
                  {step.label}
                </span>
                {dates[step.key] && (done || current) ? (
                  <span className="text-[10px] leading-none text-[#565959]">
                    {fmtShort(dates[step.key])}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <ol className="sr-only">
        {STEPS.map((step, index) => (
          <li key={step.key} aria-current={index === currentIndex ? "step" : undefined}>
            {step.label}:{" "}
            {index < currentIndex ? "completed" : index === currentIndex ? "current" : "pending"}
          </li>
        ))}
      </ol>
    </div>
  );
}
