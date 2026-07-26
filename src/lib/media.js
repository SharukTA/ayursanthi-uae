// Media helpers shared by the catalog and home-page data layers.
//
// Background: this store's Blob bandwidth was exhausted in about a day because
// grid cards autoplayed multi-MB product videos — a 13 MB clip was being pulled
// down to paint a 36px review thumbnail. Amazon never does this: search results,
// category grids and carousels show a STILL, and video only plays once you reach
// the product detail page. These helpers encode that rule at the data layer, so a
// card physically cannot be handed a video when a photo exists.

// How many media rows to pull when we only need a card thumbnail. We can't just
// `take: 1` any more — the first row by sortOrder may be a video, and we want the
// first *still*. Six is plenty to find one without dragging whole galleries.
export const CARD_MEDIA_TAKE = 6;

// Prisma select for a card thumbnail. Ordering is done by the query, so the
// caller's array arrives already sorted and `sortOrder` need not be fetched.
export const CARD_MEDIA_SELECT = { url: true, mediaType: true };

// `images` must already be ordered by sortOrder asc.
//
// Returns a 0-or-1 length array so it drops straight into the existing
// `product.images[0]` shape every card already reads — no call-site churn.
export function pickCardMedia(images = []) {
  if (images.length === 0) return [];

  // Prefer a real photo, wherever it sits in the sort order. Falling back to
  // images[0] means a video-only product still shows something (CardVideo paints
  // a first-frame poster for it without downloading the whole clip).
  const still = images.find((m) => m.mediaType !== "VIDEO");
  const chosen = still || images[0];

  return [{ url: chosen.url, mediaType: chosen.mediaType }];
}

// Hosts that `next.config.mjs` → `images.remotePatterns` allows the optimizer to
// touch. Anything else must render with `unoptimized`, because the optimizer
// answers 400 for an unlisted host — which would blank the image entirely.
//
// This matters because the admin media fields accept a pasted URL from any
// domain, not just our own uploads. Keep this in sync with next.config.mjs.
const OPTIMIZABLE_HOSTS = [
  // Vercel Blob — legacy rows written before the R2 migration.
  /\.public\.blob\.vercel-storage\.com$/,
  /^images\.pexels\.com$/,
];

// The R2 bucket's public host, read from the same env var next.config.mjs uses
// to build its remotePattern. Inlined at build time because the var is
// NEXT_PUBLIC_, so this works in the browser bundle too.
const r2Host = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL).hostname;
  } catch {
    return null;
  }
})();

// True when `src` may go through the Next image optimizer.
export function isOptimizableSrc(src) {
  if (typeof src !== "string" || src.length === 0) return false;
  // Same-origin paths ("/foo.png") are always fine.
  if (src.startsWith("/")) return true;

  try {
    const { hostname } = new URL(src);
    if (r2Host && hostname === r2Host) return true;
    return OPTIMIZABLE_HOSTS.some((pattern) => pattern.test(hostname));
  } catch {
    // Not a parseable absolute URL — let the caller render it untouched.
    return false;
  }
}
