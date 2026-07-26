// Client-safe settings helpers — no server imports (no prisma), so this module
// can be pulled into both the admin form (a client component) and the server
// API without dragging the database client into the browser bundle. The
// server-only reads live in lib/settings.js, which re-exports these.

// Settings whose value must parse to a non-negative number, with a label used in
// the error message. Everything else is free-form text. Kept here so the admin
// API and the admin form validate against exactly the same rule.
export const NUMERIC_SETTINGS = {
  free_shipping_threshold: "Free-shipping threshold",
};

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
  }
  return null;
}
