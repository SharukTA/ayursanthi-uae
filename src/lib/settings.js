import { prisma } from "@/lib/prisma";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/pricing";
import { SOCIAL_SETTINGS } from "@/lib/settings-shared";
import { DEFAULT_CANCEL_WINDOW_HOURS, normalizeCancelWindowHours } from "@/lib/order-policy";
import {
  DEFAULT_DRAW_DATE,
  DEFAULT_DRAW_TIME,
  GIFT_COUPON_THRESHOLD,
  GIFT_PROGRAM_START,
  normalizeDrawDate,
  normalizeDrawTime,
} from "@/lib/gift-shared";

// Editable site-wide settings (contact details, social links, delivery rules).
// These are the canonical keys; the admin overrides any of them in
// /admin/settings. Defaults are used until an admin saves a value, so pages
// always have something to show.
export const DEFAULT_SETTINGS = {
  contact_phone: "+91 99999 99999",
  contact_email: "support@ayurshoppee.ae",
  contact_company: "Ayursanthi Wellness Corp",
  contact_address: "Kochi, Kerala, India",
  contact_hours: "Mon-Sat, 9AM - 6PM",
  contact_dispatch: "98% Same-day dispatch",
  // Every social platform defaults to blank, which means "not set up yet, hide
  // the icon". Derived from SOCIAL_SETTINGS so the key list has one home.
  ...Object.fromEntries(Object.keys(SOCIAL_SETTINGS).map((key) => [key, ""])),
  // Goods subtotal at/above which delivery is free. Stored as a
  // string like every setting; read as a number via getFreeShippingThreshold().
  free_shipping_threshold: String(FREE_SHIPPING_THRESHOLD),
  // Hours after an order is placed during which it may still be cancelled, by
  // the customer or by the store. Read as a number via getCancelWindowHours();
  // the client reads the raw string from SettingsProvider and coerces it through
  // the same normalizeCancelWindowHours(), so both sides agree on what a bad
  // value means.
  //
  // Load-bearing twice over. It is the courier's collection deadline written
  // down, so moving it moves when parcels can still be pulled back — lengthening
  // it past the hour the courier actually collects would offer shoppers a cancel
  // button that refunds them for goods already on a van.
  //
  // It is ALSO the gap between a gift draw and the moment its entries close (see
  // entryCutoffFor in lib/gift-shared.js). A coupon must not be in the drum while
  // the order behind it can still be cancelled, or a customer can win, cancel for
  // a full refund and keep the prize. The gift cutoff is derived from this value
  // rather than configured beside it precisely so the two cannot drift apart:
  // raise this and entries start closing correspondingly earlier, on their own.
  // The visible cost is that the last N hours before a draw count towards the
  // NEXT one, so a long window shortens the run-up an admin can advertise.
  order_cancel_window_hours: String(DEFAULT_CANCEL_WINDOW_HOURS),
  // Gift draw programme (lib/gift-coupons.js). The threshold is the goods
  // subtotal that earns one coupon; `gift_program_enabled` is the master switch
  // — set it to anything but "true" and no further coupons are minted, which is
  // the lever to pull if the promotion has to stop at short notice. Coupons
  // already issued are untouched by it.
  gift_coupon_threshold: String(GIFT_COUPON_THRESHOLD),
  gift_program_enabled: "true",
  // The exact date the next draw is held on, "YYYY-MM-DD". Picked off a
  // calendar in /admin/gifts.
  //
  // The whole schedule, not a cadence: the store announces one giveaway at a
  // time on a poster, so there is exactly one upcoming draw and this is its
  // date. Changing it moves the entry cutoff — and the earliest date the draw
  // can be run — for the draw not yet closed. Draws already frozen keep the
  // window stored on their row, so moving the date never rewrites a result that
  // has already been decided.
  gift_draw_date: DEFAULT_DRAW_DATE,
  // The time of day that draw is held, "HH:MM" in store time.
  //
  // Load-bearing rather than cosmetic: the draw instant is the entry cutoff, so
  // this decides whether a purchase made on the morning of the draw is in it.
  gift_draw_time: DEFAULT_DRAW_TIME,
  // Only orders paid on or after this date count towards gift coupons.
  //
  // Load-bearing, not cosmetic. Coupons are earned on CUMULATIVE spend, so
  // without a start date every order a customer had ever placed would count the
  // moment the programme went live and long-standing customers would be handed
  // a pile of coupons by their next purchase. Blank means "count everything",
  // which is almost never what anyone wants.
  gift_program_start: GIFT_PROGRAM_START,
};

// Keys that are safe to expose publicly (all of the above are).
export const PUBLIC_SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

// Re-exported from the client-safe module so both the server API and the admin
// form (a client component) can validate saves without importing this file,
// which pulls in prisma.
export {
  DATE_SETTINGS,
  TIME_SETTINGS,
  NUMERIC_SETTINGS,
  SOCIAL_SETTINGS,
  validateSettings,
  validateSocialUrl,
} from "@/lib/settings-shared";

// Read all settings from the DB, merged over the defaults. Server-only.
export async function getSiteSettings() {
  try {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: PUBLIC_SETTING_KEYS } },
    });
    const overrides = {};
    for (const row of rows) {
      if (row.value != null && row.value !== "") overrides[row.key] = row.value;
    }
    return { ...DEFAULT_SETTINGS, ...overrides };
  } catch {
    // DB unreachable — fall back to defaults rather than crash the page.
    return { ...DEFAULT_SETTINGS };
  }
}

// The live free-shipping threshold as a number, guarded against a bad/blank
// admin value. Server-only (reads the DB). The client reads the raw string from
// /api/settings and coerces it the same way.
export async function getFreeShippingThreshold() {
  const settings = await getSiteSettings();
  const n = Number(settings.free_shipping_threshold);
  return Number.isFinite(n) && n >= 0 ? n : FREE_SHIPPING_THRESHOLD;
}

// The live cancellation window in hours, guarded against a bad, blank or
// zero admin value. Server-only; this is the read cancelOrder() goes through
// before it refunds anything, so it must not assume the admin form was the only
// writer — a "0" typed straight into the SiteSetting table would otherwise make
// every order uncancellable the instant it was placed.
export async function getCancelWindowHours() {
  const settings = await getSiteSettings();
  return normalizeCancelWindowHours(settings.order_cancel_window_hours);
}

// The live gift-coupon threshold as a number, guarded the same way. A zero or
// negative override would make the mint count in lib/gift-coupons.js unbounded,
// so it is refused here as well as in validateSettings — this is the read every
// mint actually goes through, and it must not depend on the admin form having
// been the only writer.
export async function getGiftCouponThreshold() {
  const settings = await getSiteSettings();
  const n = Number(settings.gift_coupon_threshold);
  return Number.isFinite(n) && n > 0 ? n : GIFT_COUPON_THRESHOLD;
}

// When the next draw is held: { date: "YYYY-MM-DD", time: "HH:MM" }. Server-only.
//
// Returned as a pair rather than as two getters because the two are halves of
// one instant, and a caller that fetched them separately could pair a date with
// the wrong time — the one mistake that silently moves the entry cutoff.
//
// Both are normalised on read as well as on save. validateSettings guards the
// admin form, but this is the read every date calculation goes through, and it
// must not depend on the form having been the only writer: a "2026-02-30"
// written straight into the SiteSetting table would otherwise schedule a draw in
// March.
export async function getGiftDrawSchedule() {
  const settings = await getSiteSettings();
  return {
    date: normalizeDrawDate(settings.gift_draw_date),
    time: normalizeDrawTime(settings.gift_draw_time),
  };
}

// Master switch for the gift draw programme. Anything but the exact string
// "true" is off, so a typo fails closed — no coupons minted — rather than
// silently leaving a promotion running that somebody meant to stop.
export async function isGiftProgramEnabled() {
  const settings = await getSiteSettings();
  return settings.gift_program_enabled === "true";
}

// The instant the programme started counting spend, as a Date. An unparseable
// or blank override falls back to the built-in start rather than to "the
// beginning of time" — failing open here would retroactively enrol the whole
// order history, which is the one outcome that cannot be undone quietly.
export async function getGiftProgramStart() {
  const settings = await getSiteSettings();
  const parsed = new Date(settings.gift_program_start);
  return Number.isNaN(parsed.getTime()) ? new Date(GIFT_PROGRAM_START) : parsed;
}
