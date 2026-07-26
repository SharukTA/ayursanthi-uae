// Browser-side store behind the "Continue shopping" / RECENTLY_VIEWED section —
// the SIGNED-OUT half of the feature.
//
// Signed-in shoppers do not use this at all: their history lives on their
// account (see lib/browsing-history.js) so it follows them across devices. This
// store exists so guests get the feature without an account, and so browsing
// done before signing in isn't lost — it is adopted into the account on sign-in
// and then cleared from here, which also stops one person's history leaking into
// the next account signed in on a shared computer.
//
// Note the section still renders client-side even for signed-in users: every
// page hosting it is ISR-cached (`export const revalidate = 300` in app/page.js)
// and shared byte-for-byte between visitors, so nothing personalised can be
// server-rendered into it.
//
// The stored value is a JSON array of product ids, most-recently-viewed first.

const STORAGE_KEY = "ayursanthi:recently-viewed";

// Ids kept in the browser. Deeper than any block displays, so the section still
// fills up after the shopper revisits a few products they've already seen.
const MAX_STORED = 20;

// Cheap sanity check on values coming out of localStorage: they are user-writable
// and go into an API query, so anything that isn't a plausible cuid is dropped.
function isValidId(value) {
  return typeof value === "string" && value.length > 0 && /^[a-z0-9_-]{1,64}$/i.test(value);
}

// Current history, newest first. Returns [] on the server, in private-mode
// browsers that throw on storage access, and for any corrupted value.
export function readRecentlyViewed() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidId).slice(0, MAX_STORED);
  } catch {
    return [];
  }
}

// Record a product view: move `productId` to the front, de-duplicated, and trim
// to MAX_STORED. A repeat visit re-orders the list rather than adding a copy.
export function pushRecentlyViewed(productId) {
  if (typeof window === "undefined" || !isValidId(productId)) return;
  try {
    const next = [productId, ...readRecentlyViewed().filter((id) => id !== productId)]
      .slice(0, MAX_STORED);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked — the feature is a nicety, never break the page.
  }
}

// Drop the local history. Called once the list has been adopted into a signed-in
// account (the account is authoritative from then on, and leaving a copy behind
// would show it to whoever signs in next on a shared computer), and when the
// shopper turns Browsing History off.
export function clearRecentlyViewed() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — a browser that won't let us remove it also wouldn't have
    // let us write it.
  }
}
