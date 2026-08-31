"use client";

import { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// "Closes in 04d 11h 23m 09s" — the countdown to the next gift draw.
//
// Two things this has to get right, both of which are about the first paint
// rather than the ticking:
//
//   1. NO HYDRATION MISMATCH. The remaining time is different on the server than
//      it is in the browser a moment later, so rendering a real figure during
//      SSR guarantees React finds a mismatch and blows the whole subtree away.
//      The first client render therefore emits the same placeholder the server
//      did, and only the effect — which runs after hydration — fills in numbers.
//
//   2. NO WRONG FIGURE ON A CACHED PAGE. /gifts revalidates every 5 minutes, so
//      a server-rendered countdown would be up to five minutes stale for every
//      visitor served from the cache. Computing it in the browser from an
//      absolute deadline is what makes the cache irrelevant: the HTML carries
//      the instant, not the arithmetic.
//
// The deadline is the draw instant, which is also the entry cutoff — so this is
// literally "how long you have left to qualify", not just a decoration.
// ─────────────────────────────────────────────────────────────────────────────

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function remainingFrom(deadline) {
  const left = deadline - Date.now();
  if (left <= 0) return null;
  return {
    days: Math.floor(left / DAY),
    hours: Math.floor((left % DAY) / HOUR),
    minutes: Math.floor((left % HOUR) / MINUTE),
    seconds: Math.floor((left % MINUTE) / SECOND),
  };
}

function Unit({ value, label }) {
  return (
    <div className="flex min-w-[3.25rem] flex-col items-center rounded-lg bg-slate-950/90 px-2 py-1.5 sm:min-w-[4rem] sm:px-3 sm:py-2">
      <span className="font-mono text-lg font-black leading-none text-amber-300 tabular-nums sm:text-2xl">
        {value === null ? "--" : String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[8px] font-black uppercase tracking-widest text-white/70 sm:text-[9px]">
        {label}
      </span>
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.deadline  the draw instant as an ISO string
 */
export function GiftCountdown({ deadline }) {
  const target = new Date(deadline).getTime();
  // Three states, and the distinction matters: `undefined` is "has not ticked
  // yet" (server render and first hydration pass), `null` is "the deadline has
  // passed", an object is a live figure.
  const [left, setLeft] = useState(undefined);

  useEffect(() => {
    if (Number.isNaN(target)) return undefined;

    const tick = () => setLeft(remainingFrom(target));

    // The first figure is scheduled rather than computed inline. Setting state
    // synchronously in an effect body causes a second render pass before paint,
    // and here it would also be the one render that could differ from the
    // server's — deferring it by a tick keeps the hydration pass byte-identical
    // to the HTML and lets the real numbers arrive immediately after.
    const first = setTimeout(tick, 0);
    // One second is the coarsest interval that still makes the seconds column
    // move at the rate it claims to.
    const id = setInterval(tick, SECOND);

    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [target]);

  if (Number.isNaN(target)) return null;

  // Ticked, and out of time: the draw closed while somebody sat on the page.
  // Saying so beats a frozen row of zeros, which reads as a broken widget.
  if (left === null) {
    return (
      <p className="text-xs font-black uppercase tracking-widest text-slate-950">
        Entries are closed — the draw is being held
      </p>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2" role="timer" aria-live="off">
      <Unit value={left?.days ?? null} label="Days" />
      <Unit value={left?.hours ?? null} label="Hrs" />
      <Unit value={left?.minutes ?? null} label="Min" />
      <Unit value={left?.seconds ?? null} label="Sec" />
      {/* Screen readers get the date, not a per-second ticker. aria-live on the
          digits would announce a new time every second, which is unusable. */}
      <span className="sr-only">Entries close at the draw time shown below.</span>
    </div>
  );
}
