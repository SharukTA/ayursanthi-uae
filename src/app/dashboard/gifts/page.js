"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Copy, Gift, Sparkles, Ticket, Trophy, Users } from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { formatMoney } from "@/lib/currency";
import {
  firstNameOf,
  formatDrawDate,
  formatDrawDateTime,
  GIFT_FULFILMENT_LABELS as WIN_STATUS_LABELS,
  referredWinnerName,
  shouldCelebrateWin,
} from "@/lib/gift-shared";
import { GiftPosters } from "@/components/GiftPosters";
import { GiftWinCelebration } from "@/components/GiftWinCelebration";

// Whole dirhams: the fils formatMoney shows by default are noise in this copy.
const money = (value) => formatMoney(value, { decimals: 0 });

// "My Gifts" — the customer's own view of the draw programme.
//
// The one thing this page has to get across is the difference between HAVING a
// coupon and having an ACTIVE one, because that distinction is the whole
// mechanic and it is not obvious: coupons never expire, but they only go into a
// draw if you bought something during that draw's cycle. So active coupons are
// listed first and counted in their own tile, and a dormant one says plainly
// what would wake it up.
//
// A live coupon can be out of the next draw for two unrelated reasons, and they
// need opposite wording. DORMANT means the customer has not shopped this cycle
// and another qualifying purchase brings it back. SETTLING means they just did
// shop, but too close to the draw for the order to be past its cancellation
// window in time, so the coupon counts towards the draw after this one — nothing
// is required of them and nothing is lost. Telling a customer who has just spent
// their money that they need to spend it again is the mistake this split exists
// to prevent.

function CouponCard({ coupon, onCopy, copied, threshold }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-md border p-3 ${
        coupon.voidedAt
          ? "border-slate-200 bg-slate-50 opacity-70"
          : coupon.active
            ? "border-emerald-200 bg-emerald-50/40"
            : coupon.settling
              ? "border-sky-200 bg-sky-50/40"
              : "border-slate-200 bg-white"
      }`}
    >
      <div className="min-w-0">
        <p
          className={`font-mono text-sm font-bold tracking-wide ${
            coupon.voidedAt ? "text-slate-400" : "text-slate-900"
          }`}
        >
          {coupon.code}
        </p>
        <p className="mt-0.5 text-[10px] font-normal text-slate-500">
          {coupon.order ? (
            <>
              Earned on order{" "}
              <Link
                href={`/dashboard/orders`}
                className="font-semibold text-emerald-800 hover:underline"
              >
                {coupon.order.orderNumber}
              </Link>
            </>
          ) : (
            "Earned on a past order"
          )}
        </p>
        {/* The reason line. A voided coupon already carried one; the settling
            and dormant states were explained only by a tooltip, which is
            invisible on a phone — where most of these are read. Each state now
            says its own sentence in the card, because "why is my coupon not in
            the draw?" is the single question this page exists to answer. */}
        {coupon.voidedAt ? (
          <p className="mt-0.5 text-[10px] font-normal text-amber-700">{coupon.voidReason}</p>
        ) : coupon.settling ? (
          <p className="mt-0.5 text-[10px] font-normal text-sky-800">
            Earned too close to the next draw for your order to be final in time, so this coupon
            goes into the draw after it — automatically, with nothing for you to do.
          </p>
        ) : !coupon.active ? (
          <p className="mt-0.5 text-[10px] font-normal text-amber-700">
            Waiting for your next qualifying purchase. Coupons never expire — spend another{" "}
            {money(threshold)} and every coupon you hold comes back into the draw.
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {coupon.voidedAt ? (
          <span
            className="rounded border border-amber-200 bg-white px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-700"
            title="Not in the draw at the moment. It returns when your spend qualifies again."
          >
            On hold
          </span>
        ) : coupon.active ? (
          <span className="rounded border border-emerald-200 bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-800">
            In the draw
          </span>
        ) : coupon.settling ? (
          <span
            className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-sky-800"
            title="Earned too close to this draw for the order to be final in time. It goes into the next draw automatically — there is nothing for you to do."
          >
            Next draw
          </span>
        ) : (
          <span
            className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-800"
            title="Make another qualifying purchase to bring this back into the draw"
          >
            Dormant
          </span>
        )}
        {!coupon.voidedAt ? (
          <button
            type="button"
            onClick={() => onCopy(coupon.code)}
            className="text-slate-400 transition hover:text-emerald-700"
            aria-label={`Copy ${coupon.code}`}
          >
            {copied === coupon.code ? (
              <Check className="size-3.5 text-emerald-700" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function MyGiftsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/user/gifts");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not load your gifts.");
      setData(body);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copy(code) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((current) => (current === code ? null : current)), 2000);
      toast.success("Coupon code copied.");
    } catch {
      toast.error("Could not copy automatically — please select and copy it manually.");
    }
  }

  if (error) {
    return <p className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm font-semibold text-slate-500">Loading your gifts...</p>;
  }

  // Wins the celebration at the top of the page is no longer announcing —
  // either the draw ran more than two days ago, or the prize has since been
  // delivered. Split with the very function the banner filters on, so the two
  // can never both show a win or both hide one.
  const settledWins = data.wins.filter((win) => !shouldCelebrateWin(win));

  // Active first, then the ones settling into the next draw, then dormant, then
  // on hold — the order in which they matter. Settling outranks dormant because
  // it is the better news: it needs nothing from the customer.
  const sorted = [...data.coupons].sort((a, b) => {
    const rank = (c) => (c.voidedAt ? 3 : c.active ? 0 : c.settling ? 1 : 2);
    return rank(a) - rank(b);
  });

  return (
    <PageReveal className="grid gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Gift className="size-5 text-emerald-700" />
          My Gifts
        </h1>
        <p className="mt-1 text-xs font-medium text-slate-500">
          Every {money(data.threshold)} you spend, added up across all your orders, earns a
          gift coupon for the giveaway.
        </p>
      </div>

      {/* Above everything, including the artwork: a customer who has won wants
          to be told that before they are sold the next draw. Renders nothing
          when they have not, so the page is unchanged for everybody else. */}
      <GiftWinCelebration wins={data.wins} />

      {/* The same campaign artwork the storefront runs, so a customer who came
          here from an ad recognises the page they landed on. */}
      <GiftPosters posters={data.posters} />

      {!data.enabled ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900">
          The gift draw programme is paused at the moment. Coupons you already hold keep their
          place in the next draw.
        </div>
      ) : null}

      {/* Summary */}
      <FadeIn className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-800">
            <Ticket className="size-3" />
            In the next draw
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{data.activeCount}</p>
          <p className="mt-0.5 text-[10px] font-normal text-slate-600">
            {data.drawScheduled
              ? `Drawn ${formatDrawDate(data.drawDate)}`
              : "Next draw to be announced"}
          </p>
        </div>
        <div className="rounded-md border border-border bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            Coupons held
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{data.coupons.length}</p>
          <p className="mt-0.5 text-[10px] font-normal text-slate-500">These never expire</p>
        </div>
        <div className="rounded-md border border-border bg-white p-4 shadow-sm">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
            <Trophy className="size-3" />
            Prizes won
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{data.wins.length}</p>
        </div>
      </FadeIn>

      {/* Progress towards the next coupon. The whole point of the cumulative
          rule is that partial spend is not wasted, and a bar is the only way to
          make that legible — a number alone does not read as "keep going". */}
      {data.enabled ? (
        <FadeIn className="rounded-md border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Towards your next coupon
            </p>
            <p className="text-[11px] font-semibold text-slate-700">
              {money(data.towardsNext)} of {money(data.threshold)}
            </p>
          </div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={Math.round((data.towardsNext / data.threshold) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{
                width: `${Math.min(100, (data.towardsNext / data.threshold) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-[11px] font-normal text-slate-600">
            Spend {money(data.remainingToNext)} more to earn another coupon — and that also
            brings every coupon you already hold back into the draw.
          </p>
        </FadeIn>
      ) : null}

      {/* How it works */}
      <FadeIn className="rounded-md border border-border bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
          <Sparkles className="size-3" />
          How it works
        </h2>
        <ul className="mt-2 grid gap-1.5 text-[11px] leading-relaxed text-slate-700">
          <li>
            Your spend adds up <strong>across orders</strong>. Every {money(data.threshold)}
            {" "}in total earns one coupon, so {money(20)} today and {money(80)} next week earns
            the same coupon a single {money(data.threshold)} order would. Anything left over
            carries forward.
          </li>
          <li>
            Coupons never expire. They go quiet after each draw and wake up when your spending
            reaches another full {money(data.threshold)} — and when that happens,{" "}
            <strong>every coupon you hold comes back</strong>, not just the new one. That is how
            your entries build up over time.
          </li>
          <li>
            {data.drawScheduled ? (
              <>
                The next draw is held on{" "}
                <strong>{formatDrawDateTime(data.drawDate)}</strong>
                {data.entryCutoff ? (
                  <>
                    , and entries for it close on{" "}
                    <strong>{formatDrawDateTime(data.entryCutoff)}</strong>. Anything you buy after
                    that counts towards the following draw instead — we close entries a little
                    early so that every coupon in the draw is one you can no longer cancel the
                    order behind.
                  </>
                ) : (
                  <>. Whatever you buy before that moment counts towards it.</>
                )}
              </>
            ) : (
              <>The date of the next draw has not been announced yet — your coupons are held for it.</>
            )}
          </li>
          <li>
            Cancel an order and any coupon it paid for goes <strong>on hold</strong> rather than
            being lost — the same code returns as soon as your spending qualifies again.
          </li>
          <li>
            If you were referred by another customer, they receive the same prize whenever you win.
          </li>
        </ul>
      </FadeIn>

      {/* Wins, once the celebration above has expired.

          Split rather than duplicated: a win from the last two days is already
          shown at the top of the page in full, and printing it again down here
          made the second copy read as a different, duller set of prizes. What
          this list is for is everything older — the celebration is temporary,
          but a prize the customer owns has to stay on their account for good. */}
      {settledWins.length > 0 ? (
        <FadeIn className="rounded-md border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xs font-black uppercase tracking-wide text-slate-500">Prizes won</h2>
          <div className="mt-3 grid gap-2">
            {settledWins.map((win) => (
              <div
                key={win.id}
                className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50/50 p-3"
              >
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    <Trophy className="size-3.5 text-amber-600" />
                    {win.prize.name}
                  </p>
                  <p className="mt-0.5 text-[10px] font-normal text-slate-600">
                    {formatDrawDate(win.draw.drawDate)} draw
                    {win.kind === "REFERRER" ? (
                      // Named for the same reason the celebration banner names
                      // them: this list is permanent, and "someone you
                      // referred" is exactly the detail a customer will have
                      // forgotten by the time they scroll back to it.
                      <span className="ml-1 inline-flex items-center gap-1 font-semibold text-sky-800">
                        <Users className="size-2.5" />
                        {firstNameOf(referredWinnerName(win))
                          ? `${firstNameOf(referredWinnerName(win))}, who you referred, won this`
                          : "won through someone you referred"}
                      </span>
                    ) : win.coupon ? (
                      <span className="ml-1 font-mono">· {win.coupon.code}</span>
                    ) : null}
                  </p>
                </div>
                <span className="shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-600">
                  {WIN_STATUS_LABELS[win.status] ?? win.status}
                </span>
              </div>
            ))}
          </div>
        </FadeIn>
      ) : null}

      {/* Coupons */}
      <FadeIn className="rounded-md border border-border bg-white p-4 shadow-sm">
        <h2 className="text-xs font-black uppercase tracking-wide text-slate-500">My coupons</h2>
        {sorted.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-slate-300 p-6 text-center">
            <p className="text-sm font-semibold text-slate-700">No coupons yet.</p>
            <p className="mt-1 text-[11px] font-normal text-slate-500">
              Spend {money(data.threshold)} in total to earn your first one.
            </p>
            <Link
              href="/products"
              className="mt-3 inline-flex items-center justify-center rounded-md bg-[#232f3e] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#131921]"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="mt-3 grid gap-2">
            {sorted.map((coupon) => (
              <CouponCard
                key={coupon.id}
                coupon={coupon}
                onCopy={copy}
                copied={copied}
                threshold={data.threshold}
              />
            ))}
          </div>
        )}
      </FadeIn>

      <p className="text-center text-[11px] font-normal text-slate-500">
        See every prize on offer on the{" "}
        <Link href="/gifts" className="font-semibold text-emerald-800 hover:underline">
          gifts page
        </Link>
        .
      </p>
    </PageReveal>
  );
}
