import Link from "next/link";
import { CalendarDays, Gift, Ticket, Timer, Trophy, Users } from "lucide-react";
import { FadeIn, PageReveal, Stagger, StaggerItem } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { GiftPosters } from "@/components/GiftPosters";
import { GiftCountdown } from "@/components/GiftCountdown";
import { PrizeGallery } from "@/components/PrizeGallery";
import { GiftCouponsCta } from "@/components/GiftCouponsCta";
import { GiftWinBanner } from "@/components/GiftWinCelebration";
import { getGiftCouponThreshold, getGiftDrawSchedule, isGiftProgramEnabled } from "@/lib/settings";
import { getPublishedDraws, getShowcasePrizes } from "@/lib/gift-draw";
import { getGiftPosters } from "@/lib/gift-posters";
import { formatMoney } from "@/lib/currency";
import {
  drawInstant,
  formatDrawDate,
  formatDrawDateTime,
  isDrawUpcoming,
} from "@/lib/gift-shared";

// Generated rather than static because both figures in it are admin settings:
// the coupon threshold and the date of the draw. A hardcoded description would
// keep promising "AED 100" and a date that has been and gone, and a meta
// description is exactly the copy nobody remembers to go back and fix.
export async function generateMetadata() {
  const [threshold, schedule] = await Promise.all([
    getGiftCouponThreshold(),
    getGiftDrawSchedule(),
  ]);
  // Date only in the meta description. Search results are read long after they
  // are written and the hour adds nothing there — the page itself carries the
  // exact time.
  const when = isDrawUpcoming(schedule.date, schedule.time)
    ? ` The next draw is held on ${formatDrawDate(drawInstant(schedule.date, schedule.time))}.`
    : "";

  return {
    title: "Gifts & Giveaway | Ayursanthi",
    description: `Shop for ${money(threshold)} or more and earn a gift coupon for the Ayursanthi giveaway.${when}`,
  };
}

// Admin-managed content throughout (posters, prizes, published winners), so this
// revalidates on the same cadence as the other CMS-backed public pages rather
// than being rebuilt on every request. The countdown is unaffected — it is
// computed in the browser from an absolute deadline, precisely so a page served
// from the cache cannot show a stale one.
export const revalidate = 300;

// Thresholds are whole dirhams, so the fils formatMoney shows by default would
// be noise in marketing copy. Still routed through formatMoney so a change to
// how money is written (see lib/currency.js) reaches this page too.
const money = (value) => formatMoney(value, { decimals: 0 });

/**
 * "Fathima K." — enough for a winner to recognise themselves and for the list
 * to look real, without publishing a full name next to the fact that this
 * person just won a car.
 */
function maskName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A customer";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// The mechanic, in four lines. Deliberately terse: the posters sell the
// giveaway, and these only answer the questions a poster has no room for ("do my
// coupons expire?", "what happens to the person who referred me?").
//
// Each carries a `short` as well as a `body`. On a phone the four sit in a 2x2
// grid of small chips, where a paragraph each would push the prizes off the
// screen entirely — so the short form runs there and the full sentence appears
// from `sm:` up, where there is room for it.
const STEPS = [
  {
    icon: Ticket,
    title: "Shop and earn coupons",
    short: (threshold) => `Every ${money(threshold)} spent = 1 coupon`,
    body: (threshold) =>
      `Your spending adds up across every order. Each ${money(threshold)} in total earns one gift coupon, and whatever is left over carries forward.`,
  },
  {
    icon: CalendarDays,
    title: "They never expire",
    short: () => "Buy again and they all wake up",
    body: () =>
      "Coupons never expire. They go quiet between draws and wake up the moment your spending reaches another full threshold — and when they do, EVERY coupon you hold comes back.",
  },
  {
    icon: Trophy,
    title: "The draw",
    short: () => "One coupon drawn per prize",
    body: () =>
      "One coupon is drawn at random for each prize on offer. Winners are announced here and in your account.",
  },
  {
    icon: Users,
    title: "Your referrer wins too",
    short: () => "They get the same prize you do",
    body: () =>
      "If another customer referred you, they receive the same prize, in the same quantity, whenever you win.",
  },
];

export default async function GiftsPage() {
  const [posters, prizes, threshold, publishedDraws, schedule, enabled] = await Promise.all([
    // The campaign artwork. This IS the top of the page — see components/
    // GiftPosters.js for why nothing is drawn around it.
    getGiftPosters("GIFTS", 6),
    // The open draw's pool first, then any featured prizes not already in it, so
    // a prize added while assembling a draw reaches the storefront without
    // anybody also remembering to tick "feature" on it.
    getShowcasePrizes(9),
    getGiftCouponThreshold(),
    getPublishedDraws(2),
    getGiftDrawSchedule(),
    isGiftProgramEnabled(),
  ]);

  // A date is only announced while it is still ahead of us AND the programme is
  // running. Between a draw closing and an admin picking the next date there is
  // genuinely nothing to promise, and saying "the draw is on 31 December" the
  // day after it happened is worse than saying nothing.
  const nextDraw =
    enabled && isDrawUpcoming(schedule.date, schedule.time)
      ? drawInstant(schedule.date, schedule.time)
      : null;

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <SiteHeader />

      {/* ── The posters ──────────────────────────────────────────────────────
          Edge to edge on a phone. A poster is a designed rectangle and its
          margins are part of that design; boxing it inside the page's own gutter
          shrinks the one thing this page exists to show. */}
      <section className="mx-auto w-full max-w-6xl sm:px-6 sm:pt-6 lg:px-8">
        <PageReveal>
          {posters.length > 0 ? (
            <GiftPosters posters={posters} priority />
          ) : (
            // Never an empty page. Until an admin uploads artwork this states
            // the offer in plain words — the same two facts every poster leads
            // with — rather than leaving a gap where the campaign should be.
            <div className="border-y border-[#d5d9d9] bg-white px-6 py-10 text-center sm:rounded-xl sm:border sm:shadow-sm">
              <Gift className="mx-auto size-8 text-amber-500" />
              <h1 className="mt-3 text-xl font-bold text-[#0f1111] sm:text-3xl">
                Shop {money(threshold)} or more and get a chance to win
              </h1>
              <p className="mx-auto mt-2 max-w-lg text-xs text-[#565959] sm:text-sm">
                Every {money(threshold)} you spend, added up across all your orders, earns one
                gift coupon for the giveaway.
              </p>
            </div>
          )}
        </PageReveal>
      </section>

      {/* ── "You won" ────────────────────────────────────────────────────────
          Directly under the poster, above the countdown, because a winner
          arriving here has no reason to care when the NEXT draw closes until
          they have been told about the one they just won. Client-side and
          per-visitor: this page is cached for five minutes and shared by
          everybody, so the result cannot come from the server render. Signed-out
          visitors and customers who have not won get nothing — no request, no
          markup, no layout shift.

          The gutter classes are handed to the component rather than wrapped
          around it, so that when it renders nothing there is no empty padded
          element left behind opening a gap under the poster. */}
      <GiftWinBanner className="mx-auto w-full max-w-6xl px-3 pt-3 sm:px-6 sm:pt-4 lg:px-8" />

      {/* ── Countdown + the offer, as one banner ─────────────────────────────
          Gold rather than the dark slab this page used to open with. It reads as
          a promotion at a glance, and it keeps the text dark — which is the half
          of the contrast that survives the global colour overrides intact. */}
      <section className="mx-auto w-full max-w-6xl px-3 pt-3 sm:px-6 sm:pt-4 lg:px-8">
        <FadeIn className="overflow-hidden rounded-xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 shadow-md">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-950/70">
                <Timer className="size-3" />
                {nextDraw ? "Entries close in" : "Giveaway"}
              </p>

              {nextDraw ? (
                <>
                  <div className="mt-2">
                    <GiftCountdown deadline={nextDraw.toISOString()} />
                  </div>
                  <p className="mt-2 text-[11px] font-bold text-slate-950/80 sm:text-xs">
                    Draw: {formatDrawDateTime(nextDraw)}
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-base font-black text-slate-950 sm:text-lg">
                  {enabled ? "Next draw announced soon" : "The giveaway is paused"}
                </p>
              )}
            </div>

            <div className="shrink-0 sm:text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-950/70">
                Minimum purchase
              </p>
              <p className="text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
                {money(threshold)}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 sm:justify-end">
                <Link
                  href="/products"
                  className="inline-flex flex-1 items-center justify-center rounded-md bg-slate-950 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow transition hover:-translate-y-0.5 sm:flex-none"
                >
                  Shop now
                </Link>
                <GiftCouponsCta className="inline-flex flex-1 items-center justify-center rounded-md border border-slate-950/25 bg-white/70 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-slate-950 transition hover:bg-white sm:flex-none" />
              </div>
            </div>
          </div>
        </FadeIn>

        {!enabled ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
            The giveaway is paused at the moment. Coupons you already hold keep their place in the
            next draw.
          </p>
        ) : null}
      </section>

      <section className="mx-auto w-full max-w-6xl flex-1 px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
        {/* ── The prizes ─────────────────────────────────────────────────────
            Two-up on a phone. The square photograph is the advertisement, so it
            gets the width: three-up would shrink it to a thumbnail, one-up would
            show a single prize per screenful. */}
        {prizes.length > 0 ? (
          <FadeIn className="mb-8 sm:mb-12">
            <h2 className="text-center text-[11px] font-black uppercase tracking-[0.2em] text-[#565959] sm:text-xs">
              Prizes up for grabs
            </h2>
            <Stagger className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-6 sm:grid-cols-3 sm:gap-5">
              {prizes.map((prize) => (
                <StaggerItem key={prize.id}>
                  <PrizeGallery prize={prize} />
                </StaggerItem>
              ))}
            </Stagger>
          </FadeIn>
        ) : null}

        {/* ── How it works ───────────────────────────────────────────────────
            2x2 chips on a phone, four cards from sm: up. Same four facts either
            way — the phone gets the one-line form so this stays a footnote to
            the prizes rather than a wall of text above them. */}
        <Stagger className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <StaggerItem key={step.title}>
                <div className="flex h-full flex-col rounded-xl border border-[#d5d9d9] bg-white p-3 shadow-sm sm:p-5">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-amber-400 text-slate-950 sm:size-10">
                    <Icon className="size-3.5 sm:size-5" />
                  </span>
                  <h3 className="mt-2 text-[11px] font-black leading-tight text-[#0f1111] sm:mt-3 sm:text-sm">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-[10px] font-semibold leading-snug text-[#3f4545] sm:hidden">
                    {step.short(threshold)}
                  </p>
                  <p className="mt-1.5 hidden text-xs leading-relaxed text-[#3f4545] sm:block">
                    {step.body(threshold)}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>

        {/* ── Recent winners ─────────────────────────────────────────────── */}
        {publishedDraws.length > 0 ? (
          <FadeIn className="mt-10 sm:mt-14">
            <h2 className="text-center text-lg font-bold text-[#0f1111] sm:text-3xl">
              Recent winners
            </h2>
            <div className="mt-4 grid gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-2">
              {publishedDraws.map((draw) => (
                <div
                  key={draw.id}
                  className="rounded-xl border border-[#d5d9d9] bg-white p-4 shadow-sm sm:p-5"
                >
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#565959] sm:text-xs">
                    {formatDrawDate(draw.drawDate)}
                  </p>
                  {draw.winners.length === 0 ? (
                    <p className="mt-2 text-xs text-[#565959]">No winners recorded.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-[#d5d9d9] sm:mt-3">
                      {draw.winners.map((winner) => (
                        <li
                          key={winner.id}
                          className="flex items-center justify-between gap-3 py-2 sm:py-2.5"
                        >
                          <span className="flex min-w-0 items-center gap-2 text-[11px] font-bold text-[#0f1111] sm:text-xs">
                            <Trophy className="size-3.5 shrink-0 text-amber-500" />
                            <span className="truncate">{winner.prize.name}</span>
                          </span>
                          <span className="shrink-0 text-[10px] text-[#3f4545] sm:text-[11px]">
                            {maskName(winner.user.name)}
                            {winner.kind === "REFERRER" ? (
                              <span className="ml-1 text-[9px] font-semibold text-sky-700 sm:text-[10px]">
                                (referrer)
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </FadeIn>
        ) : null}

        <p className="mt-8 text-center text-[10px] font-normal leading-relaxed text-[#565959] sm:mt-10">
          Gifts are subject to availability and may be substituted for an item of similar value.
          Winners are drawn at random from the coupons in play when the draw closes.
        </p>
      </section>

      <div className="mt-auto">
        <SiteFooter />
      </div>
    </main>
  );
}
