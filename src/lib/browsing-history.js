import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Account-side browsing history — the server half of "Continue shopping".
//
// Signed-out visitors keep their history in their own browser
// (lib/recently-viewed.js). Signing in folds that local list into the account
// once, after which this module is the single source of truth and the history
// follows the shopper across devices — the Amazon behaviour.
//
// Every function here is a no-op (or returns empty) when the shopper has turned
// Browsing History off, so that switch is enforced in one place rather than at
// each call site.
// ─────────────────────────────────────────────────────────────────────────────

// How many products the "Continue shopping" strip may draw from.
export const HISTORY_STRIP_LIMIT = 20;

// How deep the Browsing History management page lists. Amazon paginates; at this
// catalog's size one generous page is enough and far simpler.
export const HISTORY_PAGE_LIMIT = 100;

// Ids arrive from a browser's localStorage, so they are user-writable. Anything
// that isn't shaped like a cuid never reaches a query.
export function isValidProductId(value) {
  return typeof value === "string" && /^[a-z0-9_-]{1,64}$/i.test(value);
}

// Whether this shopper is recording history at all. A missing user reads as
// disabled, so a stale session can never write rows.
export async function isHistoryEnabled(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { browsingHistoryEnabled: true },
  });
  return Boolean(user?.browsingHistoryEnabled);
}

// Record one view. A repeat view of the same product bumps `viewedAt` rather
// than inserting a duplicate, which is what keeps the history de-duplicated and
// ordered without any grouping at read time.
export async function recordProductView(userId, productId) {
  if (!isValidProductId(productId)) return;
  if (!(await isHistoryEnabled(userId))) return;

  // Guard the FK before writing: a stale id from a browser that has been open
  // since before the product was retired would otherwise throw.
  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    select: { id: true },
  });
  if (!product) return;

  await prisma.productView.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId },
    update: { viewedAt: new Date() },
  });
}

// Fold a signed-out visitor's browser history into their account on sign-in.
//
// `ids` arrives most-recently-viewed first but carries no timestamps, so each is
// backdated one second further into the past than the one before it. That
// preserves their relative order while keeping all of them older than anything
// the shopper views from now on — adopting a list must never outrank live
// browsing.
//
// Products already in the account keep their existing (real) timestamp:
// `skipDuplicates` means adoption can never overwrite a genuine view.
export async function adoptGuestHistory(userId, ids) {
  const clean = [...new Set(ids.filter(isValidProductId))].slice(0, HISTORY_STRIP_LIMIT);
  if (clean.length === 0) return;
  if (!(await isHistoryEnabled(userId))) return;

  // Only ids that still point at a live product — createMany has no FK grace.
  const live = await prisma.product.findMany({
    where: { id: { in: clean }, isActive: true },
    select: { id: true },
  });
  const liveIds = new Set(live.map((p) => p.id));

  const now = Date.now();
  const rows = clean
    .filter((id) => liveIds.has(id))
    .map((id, index) => ({
      userId,
      productId: id,
      viewedAt: new Date(now - (index + 1) * 1000),
    }));

  if (rows.length === 0) return;
  await prisma.productView.createMany({ data: rows, skipDuplicates: true });
}

// This shopper's history as product ids, most recently viewed first. Empty when
// they have recording turned off — the switch hides the history as well as
// stopping new writes.
export async function getAccountHistoryIds(userId, limit = HISTORY_STRIP_LIMIT) {
  if (!(await isHistoryEnabled(userId))) return [];

  const rows = await prisma.productView.findMany({
    where: { userId, product: { isActive: true } },
    orderBy: { viewedAt: "desc" },
    take: limit,
    select: { productId: true },
  });
  return rows.map((row) => row.productId);
}
