"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Gift, Sparkles, Users, Trophy, ArrowRight, ShoppingBag } from "lucide-react";

// Hero for /gifts. Rich, animated, and looks like a real "prize event" the
// moment the page loads — independent of whether any milestone is close.
//
// Colour note: this sits on a dark teal→navy gradient. The global palette
// (see globals.css) flips `.text-white` to ink on normal surfaces, so the
// wrapper carries `hero-light` to re-assert white text on its descendants.
// Arbitrary hex values ([#0e3a38] etc.) bypass the palette remap entirely,
// and muted text uses inline rgba rather than `text-white/xx` (which the
// remap leaves invisible on light surfaces).
export function GiftsHero({ prizes = [], giftCount = 0, tierCount = 0 }) {
  const reduce = useReducedMotion();

  return (
    <section
      className="hero-light relative isolate overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(120% 120% at 15% 0%, #0e3a38 0%, #0d2e2c 42%, #0f1a20 100%)",
      }}
    >
      {/* Animated aurora glows */}
      {!reduce ? (
        <>
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -left-24 -top-24 size-[26rem] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(21,108,107,0.55), transparent 65%)", filter: "blur(20px)" }}
            animate={{ x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.12, 1] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -right-20 top-10 size-[22rem] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(255,164,28,0.28), transparent 65%)", filter: "blur(24px)" }}
            animate={{ x: [0, -50, 0], y: [0, 40, 0], scale: [1, 1.18, 1] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      ) : null}

      {/* Twinkling sparkles */}
      {!reduce ? <Sparkles3D /> : null}

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:px-8 lg:py-24">
        {/* Copy */}
        <div>
          <motion.span
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em]"
            style={{ border: "1px solid rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.08)", color: "#fff" }}
          >
            <Sparkles className="size-3.5" style={{ color: "#ffd814" }} /> Gift Draw Program
          </motion.span>

          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
            className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ color: "#fff" }}
          >
            Win real gifts at
            <br className="hidden sm:block" />{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #ffe08a 0%, #ffd814 40%, #ffa41c 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              every milestone
            </span>
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.14 }}
            className="mt-5 max-w-xl text-base leading-7"
            style={{ color: "rgba(255,255,255,0.82)" }}
          >
            As our community grows, we draw random eligible members to win the prizes
            below — smart watches, phones, gold coins, cars and more. And when you win,
            your referrer wins the very same gift too.{" "}
            <span style={{ color: "#ffe08a", fontWeight: 700 }}>Double the joy.</span>
          </motion.p>

          {/* Stats */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.22 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Stat icon={Gift} value={giftCount} label={giftCount === 1 ? "Prize up for grabs" : "Prizes up for grabs"} />
            <Stat icon={Trophy} value={tierCount} label={tierCount === 1 ? "Milestone reward" : "Milestone rewards"} />
            <Stat icon={Users} value="2×" label="You + your referrer win" plain />
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            {/* bg-emerald-700 is remapped to the Amazon-yellow CTA by globals.css */}
            <Link
              href="/products"
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-emerald-700 px-6 text-sm font-bold text-white"
            >
              <ShoppingBag className="size-4" /> Shop to qualify
            </Link>
            <a
              href="#catalog"
              className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-sm font-bold"
              style={{ border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.06)", color: "#fff" }}
            >
              See all prizes <ArrowRight className="size-4" />
            </a>
          </motion.div>
        </div>

        {/* Floating prize collage */}
        <PrizeCollage prizes={prizes} reduce={reduce} />
      </div>

      {/* Scrolling prize marquee */}
      {prizes.length > 0 ? <PrizeMarquee prizes={prizes} reduce={reduce} /> : null}
    </section>
  );
}

function Stat({ icon: Icon, value, label, plain = false }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)" }}
    >
      <span
        className="flex size-9 items-center justify-center rounded-lg"
        style={{ background: "rgba(255,216,20,0.16)", color: "#ffd814" }}
      >
        <Icon className="size-4.5" />
      </span>
      <div>
        <p className="text-lg font-extrabold leading-none" style={{ color: "#fff" }}>
          {plain ? value : <CountUp to={Number(value) || 0} />}
        </p>
        <p className="mt-1 text-[11px] font-semibold leading-none" style={{ color: "rgba(255,255,255,0.65)" }}>
          {label}
        </p>
      </div>
    </div>
  );
}

// Small number count-up on mount.
function CountUp({ to = 0, duration = 1100 }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);
  const raf = useRef(0);

  useEffect(() => {
    if (reduce) return; // initial state already equals `to`
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(eased * to));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, duration, reduce]);

  return <>{n.toLocaleString()}</>;
}

// A staggered collage of prize images that gently float. Falls back to a
// single decorative gift medallion when there are no prize images yet.
function PrizeCollage({ prizes = [], reduce }) {
  const withImg = prizes.filter((p) => p.imageUrl).slice(0, 4);

  if (withImg.length === 0) {
    return (
      <div className="relative hidden lg:block">
        <motion.div
          className="mx-auto flex size-56 items-center justify-center rounded-[2rem]"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)" }}
          animate={reduce ? undefined : { y: [0, -14, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Gift className="size-24" style={{ color: "#ffd814" }} />
        </motion.div>
      </div>
    );
  }

  const spots = [
    "left-0 top-2 size-40",
    "right-2 top-0 size-32",
    "left-8 bottom-0 size-32",
    "right-0 bottom-4 size-44",
  ];

  return (
    <div className="relative hidden h-[24rem] lg:block">
      {withImg.map((p, i) => (
        <motion.div
          key={`${p.name}-${i}`}
          className={`absolute overflow-hidden rounded-3xl shadow-2xl ${spots[i]}`}
          style={{ border: "1px solid rgba(255,255,255,0.18)", background: "#0d2e2c" }}
          initial={reduce ? false : { opacity: 0, scale: 0.85, y: 20 }}
          animate={
            reduce
              ? undefined
              : { opacity: 1, scale: 1, y: [0, i % 2 === 0 ? -12 : 12, 0] }
          }
          transition={{
            opacity: { duration: 0.6, delay: 0.2 + i * 0.12 },
            scale: { duration: 0.6, delay: 0.2 + i * 0.12 },
            y: { duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 },
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.imageUrl} alt={p.name} className="size-full object-cover" />
          <span
            className="absolute inset-x-0 bottom-0 px-3 py-2 text-[11px] font-bold"
            style={{ background: "linear-gradient(to top, rgba(6,20,19,0.92), transparent)", color: "#fff" }}
          >
            {p.name}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function PrizeMarquee({ prizes = [], reduce }) {
  const loop = [...prizes, ...prizes];
  return (
    <div
      className="relative border-t py-3"
      style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.18)" }}
    >
      <div className="flex overflow-hidden">
        <div
          className={`flex w-max shrink-0 gap-2 pr-2 ${reduce ? "" : "animate-[marquee_32s_linear_infinite]"}`}
        >
          {loop.map((p, i) => (
            <span
              key={`${p.name}-${i}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" className="size-4 rounded-full object-cover" />
              ) : (
                <Gift className="size-3.5" style={{ color: "#ffd814" }} />
              )}
              {p.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Sparkles3D() {
  // Deterministic positions so SSR and client markup match (no hydration warn).
  const dots = [
    { l: "12%", t: "22%", d: 0 },
    { l: "28%", t: "68%", d: 0.8 },
    { l: "46%", t: "14%", d: 1.6 },
    { l: "62%", t: "72%", d: 0.4 },
    { l: "78%", t: "30%", d: 1.2 },
    { l: "88%", t: "60%", d: 2 },
  ];
  return (
    <>
      {dots.map((s, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{ left: s.l, top: s.t, width: 4, height: 4, background: "#ffe08a" }}
          animate={{ opacity: [0, 1, 0], scale: [0.6, 1.3, 0.6] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: s.d }}
        />
      ))}
    </>
  );
}
