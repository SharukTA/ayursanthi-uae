"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Gift,
  Sparkles,
  Users,
  ArrowRight,
  Lock,
  LockOpen,
  Trophy,
  ShoppingBag,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollHint } from "@/components/ScrollHint";
import { NextDrawProgress } from "@/components/NextDrawProgress";

// The homepage gift-draw block. Behaves differently per visitor:
//   logged out                     -> locked teaser ("Sign in to join the draws")
//   customer, not yet eligible     -> locked card + progress toward the target
//   customer, eligible             -> unlocked: "Explore gifts" + "you're entered"
//   admin                          -> manage-program card
// Eligibility = purchased a product AND referred `threshold` direct customers who
// each purchased. Decided server-side (GET /api/gifts/me).
export function GiftDrawBlock({ teaserGifts = [], moreGifts = false }) {
  const [state, setState] = useState({ phase: "loading" });

  async function load() {
    try {
      const res = await fetch("/api/gifts/me");
      if (res.status === 401) {
        setState({ phase: "loggedOut" });
        return;
      }
      const data = await res.json();
      if (data.isAdmin) {
        setState({ phase: "admin" });
      } else {
        setState({ phase: "customer", data });
      }
    } catch {
      setState({ phase: "loggedOut" });
    }
  }

  useEffect(() => {
    load();
    // Re-sync when the user logs in/out elsewhere on the page.
    function onAuthUpdate() {
      setState({ phase: "loading" });
      load();
    }
    window.addEventListener("authUpdate", onAuthUpdate);
    return () => window.removeEventListener("authUpdate", onAuthUpdate);
  }, []);

  return (
    <motion.div
      id="reward-gift-section"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      // `hero-light`: this block sits on the hero's dark video tint, not on the
      // white page, so its `text-white` must stay white rather than being flipped
      // to ink by the global white-page legibility remap. See globals.css.
      className="hero-light relative flex flex-col gap-4"
    >
      {/* Heading */}
      <div
        className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white"
        style={{
          border: "1px solid rgba(255,255,255,0.35)",
          backgroundColor: "rgba(255,255,255,0.12)",
          textShadow: "0 1px 8px rgba(0,0,0,0.35)",
        }}
      >
        <Sparkles className="size-3.5" />
        Refer &amp; win real gifts
      </div>
      <div>
        <h2
          className="text-2xl font-bold leading-tight text-white sm:text-3xl"
          style={{ textShadow: "0 1px 14px rgba(0,0,0,0.4)" }}
        >
          Win big in the gift draws.
        </h2>
        <p
          className="mt-2 max-w-md text-sm leading-6"
          style={{ color: "rgba(255,255,255,0.85)", textShadow: "0 1px 10px rgba(0,0,0,0.35)" }}
        >
          Shop a product and refer friends who shop. Hit the target to enter every
          milestone draw — smart watches, phones, gold coins, cars and more.
        </p>
      </div>

      {/* Community progress toward the next milestone draw — shown to everyone. */}
      <NextDrawProgress tone="dark" />

      <div className="flex flex-col gap-4">
        {state.phase === "loading" ? (
          <div className="flex h-36 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
            <Loader2 className="size-5 animate-spin text-white" />
          </div>
        ) : null}

        {state.phase === "loggedOut" ? (
          <LockedTeaser teaserGifts={teaserGifts} moreGifts={moreGifts} />
        ) : null}

        {state.phase === "admin" ? (
          <AdminCard teaserGifts={teaserGifts} moreGifts={moreGifts} />
        ) : null}

        {state.phase === "customer" ? (
          <CustomerCard data={state.data} teaserGifts={teaserGifts} moreGifts={moreGifts} />
        ) : null}
      </div>

      <div className="mt-4 flex justify-center lg:hidden">
        <ScrollHint />
      </div>
    </motion.div>
  );
}

// A short row of example gift badges (with images when available).
function GiftPills({ gifts = [], more = false }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {gifts.map((g) => (
        <span
          key={g.name}
          className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold"
        >
          {g.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={g.imageUrl} alt="" className="size-3.5 rounded-full object-cover" />
          ) : (
            <Gift className="size-3" />
          )}
          {g.name}
        </span>
      ))}
      {more ? (
        <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/75">
          &amp; more
        </span>
      ) : null}
    </div>
  );
}

// `gift-card` marks this as one of the only two surfaces still allowed to carry
// the brand teal (the site footer is the other) — see globals.css. It also keeps
// the Amazon-yellow CTA rule from reaching the buttons inside.
function CardShell({ children }) {
  return (
    <div className="gift-card relative overflow-hidden rounded-2xl border border-white/15 p-5 text-white shadow-xl">
      <span className="absolute -left-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-white" />
      <span className="absolute -right-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-white" />
      {children}
    </div>
  );
}

function LockedTeaser({ teaserGifts = [], moreGifts = false }) {
  return (
    <Link href="/login" className="group block">
      <div className="gift-card relative overflow-hidden rounded-2xl border border-white/20 p-5 text-white shadow-xl transition group-hover:brightness-110">
        <span className="absolute -left-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-white" />
        <span className="absolute -right-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-white" />
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Lock className="size-6" />
          </span>
          <div>
            <p className="text-sm font-extrabold">Sign in to join the gift draws</p>
            <p className="mt-0.5 text-xs font-semibold text-white/75">
              Create a free account, shop, and refer friends to enter every draw.
            </p>
          </div>
          <ArrowRight className="ml-auto size-5 shrink-0 opacity-70 transition group-hover:translate-x-1" />
        </div>
        {teaserGifts.length > 0 ? (
          <div className="mt-4 border-t border-white/15 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Up for grabs</p>
            <GiftPills gifts={teaserGifts} more={moreGifts} />
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function AdminCard({ teaserGifts = [], moreGifts = false }) {
  return (
    <CardShell>
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <ShieldCheck className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Signed in as admin</p>
          <p className="text-base font-extrabold">You manage the gift draws</p>
        </div>
      </div>
      {teaserGifts.length > 0 ? (
        <div className="mt-4 border-t border-white/15 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Live gift catalog</p>
          <GiftPills gifts={teaserGifts} more={moreGifts} />
        </div>
      ) : (
        <p className="mt-4 border-t border-white/15 pt-3 text-xs font-semibold text-white/75">
          No gift tiers yet — add milestones and gifts to launch the draws.
        </p>
      )}
      <Button asChild className="mt-4 h-10 w-full rounded-md bg-white text-[#0f5453] hover:bg-white/90">
        <Link href="/admin/gift-draws">
          <Settings className="size-4" /> Manage gift draws
        </Link>
      </Button>
    </CardShell>
  );
}

function CustomerCard({ data, teaserGifts = [], moreGifts = false }) {
  const { purchased, qualifyingReferrals, threshold, eligible, wins = [] } = data;
  const have = Math.min(qualifyingReferrals, threshold);
  const pct = threshold > 0 ? Math.round((have / threshold) * 100) : 0;
  const remaining = Math.max(0, threshold - qualifyingReferrals);
  const unclaimed = wins.filter((w) => w.status === "WON").length;

  if (eligible) {
    return (
      <CardShell>
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#156c6b] text-[#0f5453]">
            <LockOpen className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#f8fafc]">Unlocked</p>
            <p className="text-base font-extrabold">You&apos;re entered in the gift draws! 🎉</p>
          </div>
        </div>

        {wins.length > 0 ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-bold">
            <Trophy className="size-4 text-[#156c6b]" />
            {unclaimed > 0
              ? `You won ${unclaimed} gift${unclaimed === 1 ? "" : "s"} — claim ${unclaimed === 1 ? "it" : "them"}!`
              : `You've won ${wins.length} gift${wins.length === 1 ? "" : "s"}.`}
          </div>
        ) : (
          <p className="mt-4 text-xs font-semibold text-white/80">
            Winners are drawn at each milestone. Keep your account active — every
            draw could be yours.
          </p>
        )}

        <div className="mt-4 grid gap-2">
          <Button asChild className="h-10 w-full rounded-md bg-white text-[#0f5453] hover:bg-white/90">
            <Link href="/gifts">
              Explore gifts <ArrowRight className="size-4" />
            </Link>
          </Button>
          {wins.length > 0 ? (
            // Plain link, NOT the Button component: Button's base `border` + the
            // ghost `bg-white/10` hover match the white-page outline rule in
            // globals.css, which forces teal-on-teal text at rest (invisible until
            // hover). No border class here keeps the white text visible at rest.
            <Link
              href="/dashboard/rewards"
              className="flex h-9 w-full items-center justify-center rounded-md text-sm font-semibold text-white transition hover:bg-white/10"
            >
              View my wins
            </Link>
          ) : null}
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell>
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <Lock className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Locked</p>
          <p className="text-base font-extrabold">Unlock the gift draws</p>
        </div>
      </div>

      {/* Requirement 1: purchased */}
      <div className="mt-4 flex items-center gap-2 text-xs font-semibold">
        {purchased ? (
          <CheckCircle2 className="size-4 text-[#156c6b]" />
        ) : (
          <ShoppingBag className="size-4 text-white/70" />
        )}
        <span className={purchased ? "text-white" : "text-white/75"}>
          {purchased ? "Purchased a product" : "Purchase a product"}
        </span>
      </div>

      {/* Requirement 2: referrals progress */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-white/85">
          <span className="flex items-center gap-1.5">
            <Users className="size-4" />
            {have} / {threshold} referrals who shop
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-[#156c6b] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <Button disabled className="mt-4 h-10 w-full rounded-md bg-white/20 text-white/70">
        <Lock className="size-4" /> Participate in gift events
      </Button>
      <p className="mt-2 text-center text-[11px] font-semibold text-white/70">
        {remaining > 0
          ? `Refer ${remaining} more friend${remaining === 1 ? "" : "s"} who shop${!purchased ? " and make a purchase" : ""} to unlock.`
          : "Make a purchase to unlock."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/15 pt-3">
        <Button asChild className="h-10 rounded-md bg-emerald-700 px-5 text-white hover:bg-emerald-800">
          <Link href="/dashboard/referrals">
            Start referring <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </CardShell>
  );
}
