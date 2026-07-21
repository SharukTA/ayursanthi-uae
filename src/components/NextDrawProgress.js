"use client";

import { useEffect, useState } from "react";
import { Gift, Users, Timer, PartyPopper } from "lucide-react";

// Community progress toward the NEXT milestone draw — how many paying customers
// have joined vs. how many the next tier needs. Self-fetches the public
// /api/gifts/next-draw so it can be dropped anywhere (home block, dashboard,
// /gifts) without threading data through. Renders nothing while loading or when
// there is no pending draw.
//
//   tone="dark"  -> for teal/photo backgrounds (white text, translucent surfaces)
//   tone="light" -> for white pages (slate text, emerald accents)
export function NextDrawProgress({ tone = "light", className = "" }) {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let alive = true;
    fetch("/api/gifts/next-draw")
      .then((r) => r.json())
      .then((d) => alive && setState({ status: "ready", ...d }))
      .catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, []);

  if (state.status !== "ready" || !state.nextDraw) return null;

  const dark = tone === "dark";
  const { payingCount, nextDraw } = state;
  const { label, memberThreshold, remaining, pct, reached, gifts } = nextDraw;

  const s = dark
    ? {
        // Solid teal gradient (matches the sibling gift cards) so the white text
        // stays legible — a translucent surface washes out over the light hero.
        card: "rounded-2xl border border-white/15 bg-linear-to-br from-[#232f3e] to-[#131921] p-4 text-white shadow-xl",
        eyebrow: "text-white/70",
        pill: "bg-white/15 text-white",
        pillReached: "bg-yellow-300 text-[#0f1111]",
        track: "bg-white/20",
        fill: "bg-yellow-300",
        muted: "text-white/75",
        strong: "text-white",
        giftPill: "bg-white/15 text-white",
      }
    : {
        card: "rounded-xl border border-border bg-white p-4 shadow-sm",
        eyebrow: "text-slate-500",
        pill: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        pillReached: "bg-amber-100 text-amber-800 border border-amber-200",
        track: "bg-slate-100",
        fill: "bg-emerald-600",
        muted: "text-slate-500",
        strong: "text-slate-900",
        giftPill: "bg-slate-100 text-slate-700",
      };

  return (
    <div className={`${s.card} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${s.eyebrow}`}>
          <Timer className="size-3.5" /> Next draw
        </span>
        {reached ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${s.pillReached}`}>
            <PartyPopper className="size-3" /> Drawing soon
          </span>
        ) : (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${s.pill}`}>
            {remaining.toLocaleString()} to go
          </span>
        )}
      </div>

      <p className={`mt-1.5 text-sm font-extrabold ${s.strong}`}>{label} milestone</p>

      <div className="mt-3">
        <div className={`mb-1.5 flex items-center justify-between text-xs font-semibold ${s.muted}`}>
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" />
            {payingCount.toLocaleString()} / {memberThreshold.toLocaleString()} paying customers
          </span>
          <span>{pct}%</span>
        </div>
        <div className={`h-2 overflow-hidden rounded-full ${s.track}`}>
          <div className={`h-full rounded-full transition-all ${s.fill}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <p className={`mt-2 text-[11px] font-semibold ${s.muted}`}>
        {reached
          ? "Milestone reached — winners are drawn any moment now."
          : `${remaining.toLocaleString()} more paying customer${remaining === 1 ? "" : "s"} needed to unlock this draw.`}
      </p>

      {gifts.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {gifts.slice(0, 4).map((g, i) => (
            <span
              key={`${g.name}-${i}`}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${s.giftPill}`}
            >
              {g.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.imageUrl} alt="" className="size-3 rounded-full object-cover" />
              ) : (
                <Gift className="size-3" />
              )}
              {g.name}
            </span>
          ))}
          {gifts.length > 4 ? (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${s.giftPill}`}>
              +{gifts.length - 4} more
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
