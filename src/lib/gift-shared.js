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

import { normalizeCancelWindowHours } from "@/lib/order-policy";

// The date the programme falls back to when no `gift_draw_date` setting has
// been saved. Only the fallback — the live value is the setting, which an admin
// changes from the calendar in /admin/gifts without a deploy.
export const DEFAULT_DRAW_DATE = "2026-12-31";

// The time of day the draw is held, in the store's timezone, "HH:MM" on a
// 24-hour clock. Only the fallback — the live value is the `gift_draw_time`
// setting, set beside the date on the same admin screen.
//
// This is not decoration: entries close a fixed window before the draw instant
// (see entryCutoffFor), so the time is what that cutoff is measured back from
// and it decides who is in. A giveaway advertised for 1:00 PM that was stored as
// midnight would shut out a whole day of shoppers who did exactly what the
// poster told them to.
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

/**
 * The customer whose win earned a REFERRER row its prize, or null.
 *
 * A helper rather than three copies of the same optional chain, because every
 * link in it is legitimately absent somewhere: a PRIMARY row has no
 * mirroredFrom at all, and an endpoint that simply did not select the relation
 * looks identical from here. Both must degrade to the kind-only wording rather
 * than printing "undefined" at a customer who has just been told they won.
 */
export function referredWinnerName(win) {
  const name = win?.mirroredFrom?.user?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

/**
 * First name only, for customer-facing wording.
 *
 * Matches how the winner email addresses people (lib/email-gifts.js), so a
 * referrer who reads the mail and then opens the page sees the same person
 * named the same way. The admin screens use the full name instead: staff are
 * identifying a stranger from a list, not greeting someone they know.
 */
export function firstNameOf(name) {
  return String(name ?? "").trim().split(/\s+/)[0] || null;
}
// The fulfilment steps an admin can set on a winner, and the only ones the
// admin API will accept.
//
// CLAIMED is deliberately absent. The store hands prizes over by arrangement —
// somebody calls the winner and the prize is delivered — so "claimed" never
// described a step anybody actually performed, and a third box between
// "notified" and "delivered" only invited two admins to disagree about which
// one a prize was sitting in. The value is still in the database enum
// (GiftFulfilmentStatus in schema.prisma) so that any row already carrying it
// keeps rendering; nothing can be moved INTO it any more.
export const GIFT_FULFILMENT_STATUSES = ["PENDING", "NOTIFIED", "DELIVERED"];

// The same steps, said the way a customer would.
//
// The stored value is written for the admin who moves a prize along
// ("NOTIFIED"), and showing that to the person who won it reads as a database
// leaking onto the page — worse, "PENDING" beside a prize suggests something is
// stuck when the truth is that nothing at all is required of them. CLAIMED is
// listed because a row written before it was retired must still render.
export const GIFT_FULFILMENT_LABELS = {
  PENDING: "We will contact you",
  NOTIFIED: "We have been in touch",
  CLAIMED: "Claimed",
  DELIVERED: "Delivered",
};

// How long after a draw is run the on-site celebration keeps running.
//
// A win is news for a day or two and then it is simply something the customer
// owns, so the fireworks and the gold banner expire while the prize itself does
// not — /dashboard/gifts goes on listing it for good. Measured from the moment
// the winner row was created, which is when the admin RAN the draw: that is the
// instant the result became real, and dating it from the publish instead would
// let a draw published a week late celebrate itself as though it had just
// happened.
export const WIN_CELEBRATION_WINDOW_HOURS = 48;

/**
 * Whether a win is still inside the celebration window.
 *
 * @param {Date|string} wonAt  the winner row's createdAt — when the draw was run
 * @param {Date} [now]
 */
function isWinFresh(wonAt, now = new Date()) {
  const at = new Date(wonAt).getTime();
  if (Number.isNaN(at)) return false;
  return now.getTime() - at < WIN_CELEBRATION_WINDOW_HOURS * 3600 * 1000;
}

/**
 * Whether a win should still be announced with the gold banner and fireworks.
 *
 * Two conditions, and the second is the one that matters most in practice:
 *
 *   - it happened in the last WIN_CELEBRATION_WINDOW_HOURS, and
 *   - the prize has not been handed over yet.
 *
 * A prize marked DELIVERED is finished business. The banner exists to tell a
 * customer something they do not yet know and to promise a call that has not yet
 * come — once the admin has actually handed the prize over, both halves of it
 * are false, and a page still shouting "congratulations, we will contact you"
 * about something already in the customer's hands reads as a site that has lost
 * track. So delivery closes the announcement early, whatever the clock says.
 *
 * The win stays on the customer's account either way. This decides whether it is
 * NEWS, not whether it is theirs.
 *
 * @param {{createdAt: Date|string, status?: string}} win
 * @param {Date} [now]
 */
export function shouldCelebrateWin(win, now = new Date()) {
  if (!win) return false;
  if (win.status === "DELIVERED") return false;
  return isWinFresh(win.createdAt, now);
}

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
 * This is when the draw is HELD. It is not the entry cutoff — entries close one
 * cancellation window earlier, which is what entryCutoffFor works out — but the
 * cutoff is measured back from here, so the time is still what decides whether
 * somebody who bought on the day is in the draw or the one after it.
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
 * When a draw stops accepting qualifying purchases: one cancellation window
 * before it is held.
 *
 * A coupon must not be in the drum while the order that earned it can still be
 * cancelled. Otherwise the two clocks in this system disagree — the draw treats
 * a paid order as settled the instant it is paid, while the refund policy says
 * it is not settled for another `order_cancel_window_hours` — and a customer can
 * win, be told, then cancel for a full refund and keep the prize. Nothing
 * downstream re-reads the coupon once winners exist, so that would never be
 * noticed. Closing entries early is what makes the state impossible rather than
 * something to detect and clean up afterwards.
 *
 * The window binds the store as well as the shopper (see canCancelOrder), so a
 * purchase this far back cannot be pulled by ANYBODY by the time the draw runs.
 *
 * Nothing is lost to the gap: the next draw's window starts at this cutoff, not
 * at this draw's instant, so a purchase made inside the final hours counts
 * towards the following draw instead. Both edges of every window move by the
 * same amount, which is what keeps consecutive draws tiling the calendar
 * exactly — see cycleStartFor in lib/gift-draw.js.
 *
 * @param {Date|string|number} cycleEnd  the instant the draw is held
 * @param {string|number} [windowHours]  live `order_cancel_window_hours`
 * @returns {Date|null} null when the draw instant is not a real one
 */
export function entryCutoffFor(cycleEnd, windowHours) {
  const held = new Date(cycleEnd);
  if (Number.isNaN(held.getTime())) return null;
  return new Date(held.getTime() - normalizeCancelWindowHours(windowHours) * 3600 * 1000);
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
 * The window is [cycleStart, entryCutoff) — it ends at the ENTRY CUTOFF, not at
 * the draw instant, so pass entryCutoffFor's answer (or the draw's stored
 * entryCutoff) as the third argument.
 *
 * Half-open on purpose: the cutoff instant is the first instant that no longer
 * counts towards this draw, and it is exactly where the next draw's window
 * begins. That is what lets consecutive draws tile the calendar with no gap and
 * no overlap — a coupon stamped precisely on a cutoff is in the later draw, and
 * in only one of them.
 */
export function isWithinCycle(lastQualifiedAt, cycleStart, entryCutoff) {
  const at = new Date(lastQualifiedAt).getTime();
  return at >= new Date(cycleStart).getTime() && at < new Date(entryCutoff).getTime();
}
