"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { SHOP_PROFIT_TIERS } from "@/lib/shop-shared";

// Colours are inline because globals.css turns the emerald classes grey on this page.
const NAVY = "#232f3e";
const YELLOW = "#ffd814";

// Fired when the notice is dismissed, so the store below reads the new value.
const SEEN_EVENT = "shop-profit-seen";
// What the server render and hydration see: nothing is known about this browser yet.
const UNKNOWN = "unknown";

function subscribe(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener(SEEN_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SEEN_EVENT, callback);
  };
}

// Storage can be blocked or missing (private windows, cleared site data). The page must
// still work then, just without the "your rate changed" notice.
function readSeen(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return UNKNOWN;
  }
}

function writeSeen(key, rate) {
  try {
    window.localStorage.setItem(key, String(rate));
  } catch {
    // Nothing to do: see readSeen.
  }
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Dubai",
  });
}

const unitsLabel = (count) => `${count} ${count === 1 ? "unit" : "units"}`;

/**
 * The partner's current profit % and how far they are from the next one. When the rate
 * differs from the one this browser last saw, a notice says so until they dismiss it.
 *
 * @param {object} props
 * @param {string} props.shopId
 * @param {{unitsSold: number, rate: number, previousRate: number, since: string|null,
 *   next: {minUnits: number, rate: number, unitsToGo: number}|null}} props.profitTier
 *   from getShopReport in lib/shop.js
 */
export function ShopProfitCard({ shopId, profitTier }) {
  const { unitsSold, rate, previousRate, since, next } = profitTier;
  const storageKey = `shop-profit-rate:${shopId}`;
  const seen = useSyncExternalStore(subscribe, () => readSeen(storageKey), () => UNKNOWN);

  // The first visit on this browser has nothing to compare with, so it only remembers.
  useEffect(() => {
    if (seen === null) writeSeen(storageKey, rate);
  }, [seen, storageKey, rate]);

  const seenRate = seen === null || seen === UNKNOWN ? null : Number(seen);
  const changedFrom = seenRate !== null && Number.isFinite(seenRate) && seenRate !== rate ? seenRate : null;

  const dismiss = () => {
    writeSeen(storageKey, rate);
    window.dispatchEvent(new Event(SEEN_EVENT));
  };

  const tierIndex = SHOP_PROFIT_TIERS.findIndex((tier) => tier.rate === rate);
  const tierStart = tierIndex >= 0 ? SHOP_PROFIT_TIERS[tierIndex].minUnits : 0;
  const progress = next ? Math.min(Math.max((unitsSold - tierStart) / (next.minUnits - tierStart), 0), 1) : 1;

  return (
    <section className="rounded-md border border-border bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-950">Your profit</h2>
      <p className="mt-1 text-[13px] leading-5 text-slate-600">
        Your share of the goods value of every new purchase through your link. It goes up
        with the total units sold through your link.
      </p>

      {changedFrom !== null ? (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-amber-200 bg-amber-50 p-3"
        >
          <p className="text-sm leading-5 text-slate-800">
            {rate > changedFrom ? (
              <>
                Congratulations! Your profit has gone up from {changedFrom}% to{" "}
                <span className="font-bold">{rate}%</span>. It applies to every new purchase.
              </>
            ) : (
              <>
                Your profit is now <span className="font-bold">{rate}%</span>, down from{" "}
                {changedFrom}%, because some orders were cancelled or refunded.
              </>
            )}
          </p>
          <button type="button" onClick={dismiss} className="text-xs font-semibold text-slate-900 underline">
            Got it
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-1">
        <p className="text-4xl font-extrabold leading-none text-slate-950">{rate}%</p>
        <p className="pb-0.5 text-sm text-slate-600">
          {rate > 0
            ? since
              ? `Since ${formatDate(since)}${previousRate > 0 ? `, up from ${previousRate}%` : ""}`
              : "On every new purchase"
            : `You start earning ${SHOP_PROFIT_TIERS[0].rate}% from ${SHOP_PROFIT_TIERS[0].minUnits} units sold`}
        </p>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-900">{unitsLabel(unitsSold)} sold</span>
          <span>
            {next
              ? `${unitsLabel(next.unitsToGo)} more to reach ${next.rate}%`
              : "You are on the top rate"}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={next ? `Progress to ${next.rate}% profit` : "Top profit rate reached"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="mt-2 h-2.5 overflow-hidden rounded-full"
          style={{ backgroundColor: "#eaeded" }}
        >
          <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, backgroundColor: YELLOW }} />
        </div>
      </div>

      <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SHOP_PROFIT_TIERS.map((tier) => {
          const current = tier.rate === rate;
          const reached = unitsSold >= tier.minUnits;
          return (
            <li
              key={tier.minUnits}
              aria-current={current ? "true" : undefined}
              className="rounded-md border p-3"
              style={
                current
                  ? { backgroundColor: NAVY, borderColor: NAVY, color: "#ffffff" }
                  : { backgroundColor: "#ffffff", borderColor: "#d5d9d9", color: "#0f1111" }
              }
            >
              <p className="flex items-center gap-1 text-lg font-extrabold" style={{ color: "inherit" }}>
                {tier.rate}%
                {reached && !current ? <Check className="size-4" aria-label="reached" /> : null}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: "inherit", opacity: 0.85 }}>
                {tier.minUnits}+ units{current ? " · you are here" : ""}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
