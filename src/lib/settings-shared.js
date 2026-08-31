// Client-safe settings helpers — no server imports (no prisma), so this module
// can be pulled into both the admin form (a client component) and the server
// API without dragging the database client into the browser bundle. The
// server-only reads live in lib/settings.js, which re-exports these.

// Settings whose value must parse to a non-negative number, with a label used in
// the error message. Everything else is free-form text. Kept here so the admin
// API and the admin form validate against exactly the same rule.
export const NUMERIC_SETTINGS = {
  free_shipping_threshold: "Free-shipping threshold",
  // Goods subtotal that earns one gift coupon. Every whole multiple of it in a
  // paid order mints another coupon, so 250 AED at a 100 AED threshold earns
  // two. Zero would mint an unbounded number of coupons per order, so it is
  // rejected below rather than merely warned about.
  gift_coupon_threshold: "Gift coupon threshold",
  // Hours after an order is placed during which it can still be cancelled.
  // Listed in POSITIVE_SETTINGS too: a zero window would close cancellation for
  // the entire store, which is not something a stray keystroke should do.
  order_cancel_window_hours: "Cancellation window",
};

// Settings holding a calendar date, as the "YYYY-MM-DD" a date input produces.
// Blank is allowed everywhere (it clears the override); a present value must be
// a real day, so 2026-02-30 is refused rather than silently rolling into March.
export const DATE_SETTINGS = {
  gift_draw_date: "Gift draw date",
  gift_program_start: "Gift programme start date",
};

// Settings holding a time of day, as the "HH:MM" a time input produces. Some
// browsers append seconds, so those are tolerated and ignored — the draw is not
// scheduled to the second.
export const TIME_SETTINGS = {
  gift_draw_time: "Gift draw time",
};

// Numeric settings that additionally may not be zero. Checked inside the same
// loop as NUMERIC_SETTINGS, so a key listed here must also be listed there.
const POSITIVE_SETTINGS = new Set(["gift_coupon_threshold", "order_cancel_window_hours"]);

// Validate an incoming { key: value } settings map before it is saved. A blank
// value is allowed (it clears the override and falls back to the default), but a
// present numeric setting must be a real number >= 0 — otherwise the value would
// be silently ignored by getFreeShippingThreshold() and the admin would think a
// bad threshold had taken effect. Returns a user-facing message, or null if OK.
export function validateSettings(incoming) {
  for (const [key, label] of Object.entries(NUMERIC_SETTINGS)) {
    if (!incoming || !(key in incoming)) continue;
    const raw = incoming[key];
    if (raw == null || String(raw).trim() === "") continue; // blank = use default
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      return `${label} must be a number of 0 or more (leave blank to use the default).`;
    }
    // Zero is a legal free-shipping threshold ("everything ships free") but not
    // a legal coupon threshold: the mint count is subtotal / threshold, so zero
    // would ask for an unbounded number of coupons on every order. Nor is it a
    // legal cancellation window — that would leave every order uncancellable
    // from the instant it was placed.
    if (POSITIVE_SETTINGS.has(key) && n === 0) {
      return `${label} must be greater than 0 (leave blank to use the default).`;
    }
  }
  for (const [key, label] of Object.entries(DATE_SETTINGS)) {
    if (!incoming || !(key in incoming)) continue;
    const raw = incoming[key];
    if (raw == null || String(raw).trim() === "") continue; // blank = use default
    if (!isCalendarDate(raw)) {
      return `${label} must be a real date (leave blank to use the default).`;
    }
  }
  for (const [key, label] of Object.entries(TIME_SETTINGS)) {
    if (!incoming || !(key in incoming)) continue;
    const raw = incoming[key];
    if (raw == null || String(raw).trim() === "") continue; // blank = use default
    if (!/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.test(String(raw).trim())) {
      return `${label} must be a time of day on a 24-hour clock, like 13:00 (leave blank to use the default).`;
    }
  }
  for (const [key, label] of Object.entries(SOCIAL_SETTINGS)) {
    if (!incoming || !(key in incoming)) continue;
    if (!validateSocialUrl(incoming[key])) {
      return `${label} must be a full link starting with https:// (leave blank to hide it).`;
    }
  }
  return null;
}

/**
 * True for a "YYYY-MM-DD" that names a day that actually exists.
 *
 * Deliberately a local copy rather than an import of parseDrawDate: this module
 * is the client-safe half of settings and is pulled into the admin form, and
 * pointing it at the gift calendar would drag that whole module in for one
 * regex. The two agree because both refuse anything the round-trip below does
 * not reproduce exactly.
 */
function isCalendarDate(raw) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw).trim());
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const probe = new Date(Date.UTC(year, month, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month &&
    probe.getUTCDate() === day
  );
}

// The social platforms the store can link to, in the order they are rendered.
// The key is the setting key; the label is used both in the admin form and in
// the validation message. Adding a platform here is most of the work — the key
// flows into DEFAULT_SETTINGS (lib/settings.js), which is what PUBLIC_SETTING_KEYS
// and both settings APIs are derived from. The only other place to touch is the
// icon map in components/SocialLinks.js.
export const SOCIAL_SETTINGS = {
  social_instagram: "Instagram",
  social_facebook: "Facebook",
  social_youtube: "YouTube",
  social_linkedin: "LinkedIn",
  social_twitter: "X / Twitter",
};

// A social link must be an absolute http(s) URL. Without this an admin who types
// "instagram.com/ayursanthi" gets a *relative* href — the footer would quietly
// link to /instagram.com/ayursanthi and 404, which is the kind of breakage
// nobody notices for months. Blank is still fine: it means "hide this icon".
export function validateSocialUrl(raw) {
  const value = String(raw ?? "").trim();
  if (value === "") return true; // blank = platform hidden
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}
