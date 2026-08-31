// Gift-draw calendar maths and enum lists.
//
// Client-safe: no prisma, no server imports, so the customer dashboard and the
// admin screens can work out "when is the draw?" without pulling the database
// client into the browser bundle. The server-only halves live in
// lib/gift-coupons.js (minting) and lib/gift-draw.js (running a draw), both of
// which import from here — same split as settings-shared.js / settings.js.
//
// A draw is scheduled by EXACT DATE, not by a monthly cadence. The store runs
// one giveaway at a time and announces its date on a poster ("31/12/2026"), so
// the date is a single admin setting (`gift_draw_date`) an admin picks off a
// calendar rather than a day-of-month the code extrapolates forward for ever.
// That is also why the qualifying window cannot be computed here: it runs from
// the previous draw to this one, and "the previous draw" is a database
// question. It lives in lib/gift-draw.js, and every GiftDraw stores the window
// it was frozen against.

// The date the programme falls back to when no `gift_draw_date` setting has
// been saved. Only the fallback — the live value is the setting, which an admin
// changes from the calendar in /admin/gifts without a deploy.
export const DEFAULT_DRAW_DATE = "2026-12-31";

// The time of day the draw is held, in the store's timezone, "HH:MM" on a
// 24-hour clock. Only the fallback — the live value is the `gift_draw_time`
// setting, set beside the date on the same admin screen.
//
// This is not decoration: the draw instant is also the ENTRY CUTOFF, so the time
// decides whether somebody who buys on the morning of the draw is in it. A
// giveaway advertised for 1:00 PM that closed its list at midnight would shut
// out a whole day of shoppers who did exactly what the poster told them to.
export const DEFAULT_DRAW_TIME = "13:00";

// Goods subtotal, in AED, that earns one gift coupon. Only the fallback — the
// live value is the `gift_coupon_threshold` site setting, which an admin can
// change without a deploy (see getGiftCouponThreshold in lib/settings.js).
export const GIFT_COUPON_THRESHOLD = 100;

// The date the programme began counting spend. Only the fallback — the live
// value is the `gift_program_start` site setting. Orders paid before this never
// count towards a coupon, which is what stops the whole existing order history
// converting into coupons the first time a returning customer buys something.
export const GIFT_PROGRAM_START = "2026-08-30";

// The store runs on Gulf Standard Time. Hardcoded as a fixed offset rather than
// an IANA zone because GST has no daylight saving and never has — so the offset
// is a constant, and treating it as one keeps every boundary in this file exact
// arithmetic instead of a timezone-database lookup that has to work identically
// on the server and in the browser.
export const STORE_UTC_OFFSET_HOURS = 4;

export const GIFT_DRAW_STATUSES = ["SCHEDULED", "FROZEN", "DRAWN", "PUBLISHED"];
export const GIFT_WINNER_KINDS = ["PRIMARY", "REFERRER"];
export const GIFT_FULFILMENT_STATUSES = ["PENDING", "NOTIFIED", "CLAIMED", "DELIVERED"];

// Where an uploaded gift poster is shown. The public /gifts page is the shop
// window; the dashboard placement puts the same artwork in front of customers
// who already hold coupons, which is a different audience and often a different
// poster ("claim your prize" rather than "come and shop").
export const GIFT_POSTER_PLACEMENTS = ["GIFTS", "DASHBOARD", "BOTH"];

/**
 * Read a placement off the wire.
 *
 * Anything unrecognised becomes "BOTH" rather than failing the save — a poster
 * on one page too many is a smaller problem than a rejected upload, and the
 * admin can see and fix it on the row.
 */
export function normalizePlacement(value, fallback = "BOTH") {
  const placement = String(value ?? "").trim().toUpperCase();
  return GIFT_POSTER_PLACEMENTS.includes(placement) ? placement : fallback;
}

/**
 * Split "2026-12-31" into its parts, or null for anything that is not a real
 * calendar date.
 *
 * Strict on purpose. Date.UTC happily rolls 2026-02-30 into 2 March, so a typo
 * would otherwise schedule the draw in a month nobody chose — the components are
 * read back off the constructed date and compared, which is the only check that
 * catches that.
 */
export function parseDrawDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  const probe = new Date(Date.UTC(year, monthIndex, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== monthIndex ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, monthIndex, day };
}

/**
 * Coerce a stored or typed draw date into a usable "YYYY-MM-DD".
 *
 * Every calendar function runs its argument through this, so a corrupt setting
 * — a blank, a word, a 30 February typed straight into the database — degrades
 * to the default date instead of scheduling a draw nobody can explain. Failing
 * back is safe in a way that failing open is not: the worst case is a date an
 * admin can see on the Gifts screen and correct.
 */
export function normalizeDrawDate(value, fallback = DEFAULT_DRAW_DATE) {
  return parseDrawDate(value) ? String(value).trim() : fallback;
}

/**
 * Split "13:00" into its parts, or null for anything that is not a real time of
 * day.
 *
 * Accepts the "HH:MM:SS" some browsers hand back from a time input and throws
 * the seconds away — a draw is not scheduled to the second, and keeping them
 * would make two equal times compare unequal.
 */
export function parseDrawTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(String(value ?? "").trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/**
 * Coerce a stored or typed time into a usable "HH:MM", falling back the same way
 * normalizeDrawDate does and for the same reason: a corrupt setting must degrade
 * to a sane cutoff rather than to no draw at all.
 */
export function normalizeDrawTime(value, fallback = DEFAULT_DRAW_TIME) {
  const parsed = parseDrawTime(value);
  if (!parsed) return fallback;
  return `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
}

/**
 * The exact instant a draw is held: the chosen time, Gulf time, on the chosen
 * date, as a UTC Date.
 *
 * Subtracting the store offset from the hour is deliberate and well-defined —
 * Date.UTC rolls a negative or out-of-range hour into the neighbouring day, so
 * 01:00 GST on the 31st comes out as 21:00 UTC on the 30th with no special case.
 *
 * This instant is also the entry cutoff, which is why the time is worth setting
 * properly: everything bought before it counts towards the draw, and everything
 * from it onwards counts towards the next one.
 *
 * @param {string} isoDate  "YYYY-MM-DD"
 * @param {string} [time]   "HH:MM" in store time
 * @returns {Date|null} null when the date is not a real one
 */
export function drawInstant(isoDate, time = DEFAULT_DRAW_TIME) {
  const parsed = parseDrawDate(isoDate);
  if (!parsed) return null;
  const { hour, minute } = parseDrawTime(time) ?? parseDrawTime(DEFAULT_DRAW_TIME);
  return new Date(
    Date.UTC(
      parsed.year,
      parsed.monthIndex,
      parsed.day,
      hour - STORE_UTC_OFFSET_HOURS,
      minute
    )
  );
}

/**
 * An instant written back as the store-local "YYYY-MM-DD" a date input expects.
 *
 * Shifting into the store's offset before reading the UTC parts is what keeps
 * the calendar honest for an admin sitting anywhere else: 20:00 UTC on the 30th
 * IS the 31st in Dubai, and a picker that showed the 30th would silently move
 * the draw a day every time it was opened and saved.
 */
export function toDrawDateInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() + STORE_UTC_OFFSET_HOURS * 3600 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * An instant written back as the store-local "HH:MM" a time input expects — the
 * companion to toDrawDateInput, shifted into the store's offset for the same
 * reason.
 */
export function toDrawTimeInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() + STORE_UTC_OFFSET_HOURS * 3600 * 1000);
  return shifted.toISOString().slice(11, 16);
}

/**
 * Today's date in the store's timezone, as "YYYY-MM-DD".
 *
 * This is the `min` on the admin calendar — the draw may be scheduled for today
 * or any later day, never for one that has already gone.
 */
export function todayDrawDate(now = new Date()) {
  return toDrawDateInput(now);
}

/** The current time in the store's timezone, as "HH:MM". */
export function nowDrawTime(now = new Date()) {
  return toDrawTimeInput(now);
}

/**
 * Whether a scheduled date is still ahead of us — i.e. worth announcing as
 * "the next draw".
 *
 * Compared against the draw INSTANT — date AND time — rather than the date
 * string, so it flips at exactly the moment the entry cutoff does. A draw set
 * for 1:00 PM today is still upcoming at noon and over at one. Once it is over
 * the storefront stops promising it and the admin is prompted to pick the next.
 */
export function isDrawUpcoming(isoDate, time = DEFAULT_DRAW_TIME, now = new Date()) {
  const instant = drawInstant(isoDate, time);
  return Boolean(instant) && now.getTime() < instant.getTime();
}

/**
 * Human label for a draw: "31 December 2026". Rendered in the store's timezone
 * so the date shown is the date the draw is actually held on — formatting a
 * 20:00-UTC instant in the viewer's own zone would show the 30th to anyone west
 * of Greenwich.
 */
export function formatDrawDate(value) {
  return new Date(value).toLocaleDateString("en-AE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dubai",
  });
}

/**
 * "31 December 2026 at 1:00 PM" — the same instant with the hour, for the places
 * that ANNOUNCE a draw rather than merely date one.
 *
 * Used for the upcoming draw and nowhere else: a draw already held is identified
 * by its date, and printing the minute it ran adds nothing to a list of past
 * winners. Fixed to Asia/Dubai like formatDrawDate, so every visitor is told the
 * hour the store actually draws at rather than the hour it falls on in their own
 * timezone.
 */
export function formatDrawDateTime(value) {
  const date = new Date(value);
  return `${formatDrawDate(date)} at ${date.toLocaleTimeString("en-AE", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Dubai",
  })}`;
}

/**
 * Whether a coupon's lastQualifiedAt falls inside a draw's qualifying window.
 *
 * Half-open on purpose: the instant of the draw is the first instant that no
 * longer counts towards it, which is what lets consecutive draws tile the
 * calendar with no gap and no overlap.
 */
export function isWithinCycle(lastQualifiedAt, cycleStart, cycleEnd) {
  const at = new Date(lastQualifiedAt).getTime();
  return at >= new Date(cycleStart).getTime() && at < new Date(cycleEnd).getTime();
}
