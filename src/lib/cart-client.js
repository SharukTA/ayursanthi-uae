/**
 * The one door every cart screen goes through.
 *
 * There are two carts in this store, following Amazon's model:
 *
 *   signed in  — the account cart in the database (lib/cart.js). It follows the
 *                shopper to any device or browser, and its prices are always
 *                live because nothing about the product is stored with the line.
 *   signed out — a cart in the visitor's own browser (localStorage). They get
 *                the feature without an account, and on sign-in it is MERGED
 *                into the account cart and then dropped.
 *
 * Callers never say which one they want. Each function asks the server first; a
 * 401 means "signed out", and only then does the browser cart get touched. That
 * is deliberately one round trip rather than a client-side `isLoggedIn` flag —
 * a stale flag is how a cart ends up written to the wrong place.
 *
 * Every function returns the resulting line-item array in the same shape from
 * both paths, so screens render one thing and never branch on the source.
 */

export const CART_STORAGE_KEY = "ayursanthi_cart";
export const BUYNOW_STORAGE_KEY = "ayursanthi_buynow";

// Mirrors MAX_LINE_QUANTITY in lib/cart.js. The server is authoritative; this
// only keeps the signed-out cart from drifting somewhere the server would clamp.
const MAX_LINE_QUANTITY = 30;

const JSON_HEADERS = { "Content-Type": "application/json" };

// ─────────────────────────────────────────────────────────────────────────────
// The browser cart (signed-out visitors)
// ─────────────────────────────────────────────────────────────────────────────

export function readGuestCart() {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function writeGuestCart(items) {
  if (typeof window === "undefined") return items;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked (private mode). The cart is degraded, not broken.
  }
  return items;
}

/**
 * Drop the browser cart. Called once it has been merged into an account (the
 * account is authoritative from then on) and again on sign-out — leaving a copy
 * behind is what would show one person's cart to whoever signs in next on a
 * shared computer.
 */
export function clearGuestCart() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // Nothing to do; the next read just returns whatever is still there.
  }
}

/** Tells the header badge (and any other listener) to re-read the cart. */
export function notifyCartChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("cartUpdate"));
}

// Lines saved before the checkboxes existed have no `selected` flag and are
// treated as ticked, so an old cart still checks out in full.
export function isLineSelected(item) {
  return item?.selected !== false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Talking to the account cart
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One request to /api/cart.
 *
 * @returns {Promise<{signedOut:true}|{items:Array, capped?:boolean}>}
 *   `signedOut` is the caller's cue to use the browser cart instead. A real
 *   failure throws, so screens can surface it.
 */
async function callCartApi(method, { body, query } = {}) {
  const res = await fetch(`/api/cart${query || ""}`, {
    method,
    cache: "no-store",
    ...(body ? { headers: JSON_HEADERS, body: JSON.stringify(body) } : {}),
  });

  // 401 = signed out. 403 = an admin, who has no cart to speak of; treating it
  // as an empty account cart keeps them out of the browser cart entirely.
  if (res.status === 401) return { signedOut: true };
  if (res.status === 403) return { items: [] };

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Could not update your cart.");
  return data;
}

/**
 * Hand the browser cart to the account that has just signed in.
 *
 * Guarded by a single in-flight promise: the header badge, the cart page and
 * checkout can all mount at once, and merging the same browser cart twice would
 * double every quantity.
 */
let mergeInFlight = null;

async function adoptGuestCart() {
  // Someone else got here first. Wait for their merge rather than reading a
  // cart that is halfway through being rewritten.
  if (mergeInFlight) return mergeInFlight;

  const guestItems = readGuestCart();
  if (guestItems.length === 0) return null;

  mergeInFlight = (async () => {
    const res = await fetch("/api/cart/merge", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        // Only the id and quantity are trusted by the server; sending the
        // cached price/name would be pointless as well as unsafe.
        items: guestItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      }),
    });

    // An admin (403) has no cart, but their browser copy still has to go or it
    // would be waiting for the next person to sign in on this computer.
    if (res.status === 403) {
      clearGuestCart();
      return [];
    }
    if (!res.ok) return null;

    const data = await res.json();
    // Ownership has moved to the account — the browser copy is now a stale
    // duplicate and must not survive.
    clearGuestCart();
    // Nudge anything already on screen (the header badge above all) to re-read,
    // in case it loaded its copy just before the merge landed.
    notifyCartChanged();
    return data.items || [];
  })()
    .catch(() => null) // Merge failed: keep the browser cart and retry later.
    .finally(() => {
      mergeInFlight = null;
    });

  return mergeInFlight;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — used by CartBadge, the cart page, checkout and ProductActions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load the cart, merging in anything bought while signed out.
 *
 * @returns {Promise<{items:Array, source:"account"|"guest"}>}
 */
export async function getCart() {
  let data;
  try {
    data = await callCartApi("GET");
  } catch {
    // The server is unreachable, so we cannot tell a signed-out visitor from a
    // signed-in one. Falling back to the browser cart is right either way: a
    // visitor's cart lives there, and a signed-in shopper's browser cart is
    // empty unless a merge failed — in which case those items are still theirs
    // and will merge on the next successful load.
    return { items: readGuestCart(), source: "guest" };
  }

  if (data.signedOut) {
    return { items: readGuestCart(), source: "guest" };
  }

  // First load after signing in: fold the browser cart into the account. Cheap
  // no-op (returns null immediately) once there is nothing left to adopt.
  const merged = await adoptGuestCart();
  if (merged) return { items: merged, source: "account" };

  return { items: data.items || [], source: "account" };
}

/** Total units in the cart — what the header badge shows. */
export async function getCartCount() {
  const { items } = await getCart();
  return items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
}

/**
 * Add a product to the cart. Adding one already in the cart stacks onto the
 * existing line rather than replacing it.
 *
 * @param {object} line a full line-item snapshot (see buildLineItem in
 *   ProductActions). Only productId/quantity reach the account cart; the rest is
 *   what the browser cart has to store for itself.
 * @returns {Promise<{items:Array, capped:boolean}>}
 */
export async function addToCart(line) {
  const quantity = Math.max(1, Math.floor(Number(line.quantity)) || 1);

  const data = await callCartApi("POST", {
    body: { productId: line.productId, quantity },
  });

  if (!data.signedOut) {
    notifyCartChanged();
    return { items: data.items || [], capped: Boolean(data.capped) };
  }

  const items = readGuestCart();
  const index = items.findIndex((item) => item.productId === line.productId);
  const ceiling = Math.min(MAX_LINE_QUANTITY, Math.max(Number(line.stock) || 0, 0) || MAX_LINE_QUANTITY);

  let capped = false;
  if (index > -1) {
    const requested = (Number(items[index].quantity) || 0) + quantity;
    const next = Math.min(requested, ceiling);
    capped = next < requested;
    items[index] = { ...items[index], ...line, quantity: next, selected: true };
  } else {
    const next = Math.min(quantity, ceiling);
    capped = next < quantity;
    items.push({ ...line, quantity: next, selected: true });
  }

  writeGuestCart(items);
  notifyCartChanged();
  return { items, capped };
}

/** Set one line's quantity. 0 or less removes the line. */
export async function setCartQuantity(productId, quantity) {
  const data = await callCartApi("PATCH", { body: { productId, quantity } });

  if (!data.signedOut) {
    notifyCartChanged();
    return { items: data.items || [], capped: Boolean(data.capped) };
  }

  const next = Math.floor(Number(quantity));
  const items =
    !Number.isFinite(next) || next <= 0
      ? readGuestCart().filter((item) => item.productId !== productId)
      : readGuestCart().map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.min(next, MAX_LINE_QUANTITY) }
            : item
        );

  writeGuestCart(items);
  notifyCartChanged();
  return { items, capped: false };
}

/** Tick or untick a single line. */
export async function setCartLineSelected(productId, selected) {
  const data = await callCartApi("PATCH", { body: { productId, selected } });

  if (!data.signedOut) {
    notifyCartChanged();
    return { items: data.items || [] };
  }

  const items = readGuestCart().map((item) =>
    item.productId === productId ? { ...item, selected: Boolean(selected) } : item
  );
  writeGuestCart(items);
  notifyCartChanged();
  return { items };
}

/** Tick or untick every line — the cart's "Select all items" box. */
export async function setAllCartLinesSelected(selected) {
  const data = await callCartApi("PATCH", { body: { selectAll: Boolean(selected) } });

  if (!data.signedOut) {
    notifyCartChanged();
    return { items: data.items || [] };
  }

  const items = readGuestCart().map((item) => ({ ...item, selected: Boolean(selected) }));
  writeGuestCart(items);
  notifyCartChanged();
  return { items };
}

/** Remove a line outright. */
export async function removeFromCart(productId) {
  const data = await callCartApi("DELETE", {
    query: `?productId=${encodeURIComponent(productId)}`,
  });

  if (!data.signedOut) {
    notifyCartChanged();
    return { items: data.items || [] };
  }

  const items = readGuestCart().filter((item) => item.productId !== productId);
  writeGuestCart(items);
  notifyCartChanged();
  return { items };
}

/**
 * Tidy up after an order is placed.
 *
 * The account cart has already had the purchased lines removed inside the order
 * transaction (lib/checkout.js), and unselected lines were deliberately left
 * behind — so there is nothing to ask the server for. Only a browser copy could
 * still be holding what was just bought.
 */
export function finalizePurchase(purchasedProductIds) {
  const ids = new Set(purchasedProductIds || []);
  const remaining = readGuestCart().filter((item) => !ids.has(item.productId));

  if (remaining.length > 0) writeGuestCart(remaining);
  else clearGuestCart();

  notifyCartChanged();
}

// ─────────────────────────────────────────────────────────────────────────────
// "Buy Now" — deliberately NOT part of the cart
// ─────────────────────────────────────────────────────────────────────────────
// A single item stashed on its way to checkout, exactly like Amazon's Buy Now:
// it never enters the cart and never changes the cart's total. It is a one-shot
// handoff between two screens in the same tab, so the browser is the right place
// for it whether or not the shopper is signed in.

export function stashBuyNowItem(line) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BUYNOW_STORAGE_KEY, JSON.stringify(line));
}

export function readBuyNowItem() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(BUYNOW_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

export function clearBuyNowItem() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(BUYNOW_STORAGE_KEY);
  } catch {
    // Nothing to do — a leftover buy-now item is only read behind ?buynow=1.
  }
}
