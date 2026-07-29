import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export function jsonError(message, status = 400, details = undefined) {
  return Response.json({ message, details }, { status });
}

// Guard for admin-only API routes. Usage:
//   const { error, session } = await requireAdmin();
//   if (error) return error;
// Returns a 403 Response in `error` when the caller is not an authenticated ADMIN.
//
// The role is confirmed against the DATABASE, not just the `role` claim baked
// into the session cookie at login. The cookie is valid for 7 days, so trusting
// it alone would let a demoted (or deleted) admin keep full write access to
// every admin endpoint until it expired. This is the API-side counterpart of the
// same check in app/admin/layout.js, and it is the one that actually guards the
// data — the layout only guards the UI.
export async function requireAdmin() {
  const session = await getSession();
  if (!session?.userId || session.role !== "ADMIN") {
    return { error: jsonError("Administrator access required.", 403), session: null };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  if (user?.role !== "ADMIN") {
    return { error: jsonError("Administrator access required.", 403), session: null };
  }

  return { error: null, session };
}

// Valid Order.status values — keep in sync with the OrderStatus enum in
// prisma/schema.prisma. Ordered as the normal fulfillment lifecycle; CANCELLED
// is a terminal off-path state an admin can set at any point.
export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
];

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// Slugs are unique per table (see prisma/schema.prisma) but NAMES are not — two
// products can legitimately share one ("Ashwagandha Churna" from two brands, a
// relisted pack, a variant the admin names identically). So the slug derived
// from the name is only a *base*: when it is already taken, the next free
// "-1", "-2" … suffix is appended instead of failing the save with a unique
// constraint error the admin can do nothing about.
//
// `model` is the Prisma delegate to check ("product" or "category").
// `excludeId` skips the row being edited so it never collides with itself, and
// `currentSlug` keeps that row's existing suffix stable — renumbering it on
// every unrelated save would silently change a live URL.
export async function uniqueSlug(baseSlug, model, { excludeId = null, currentSlug = null } = {}) {
  const base = slugify(baseSlug);
  if (!base) return base;

  // `startsWith` also pulls in unrelated longer slugs ("ashwagandha-churna-plus"
  // when the base is "ashwagandha-churna"); harmless, they simply never match a
  // candidate below.
  const rows = await prisma[model].findMany({
    where: {
      slug: { startsWith: base },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { slug: true },
  });

  const taken = new Set(rows.map((row) => row.slug));

  if (!taken.has(base)) return base;
  if (currentSlug && isSuffixedVariant(currentSlug, base)) return currentSlug;

  let suffix = 1;
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

// True for "ashwagandha-churna-2" against base "ashwagandha-churna" — i.e. this
// slug is already a numbered variant of the base, not a different slug that
// merely starts with it.
function isSuffixedVariant(slug, base) {
  if (!slug.startsWith(`${base}-`)) return false;
  return /^\d+$/.test(slug.slice(base.length + 1));
}

export function cleanString(value) {
  const trimmed = String(value || "").trim();
  return trimmed.length ? trimmed : null;
}

// Resolve an admin-supplied categoryId into something safe to write to
// Product.categoryId.
//
// A product's category is OPTIONAL (the column is nullable — see
// prisma/schema.prisma), so a blank/missing value simply means "uncategorized".
// An id that no longer resolves to a real category — the admin left the product
// form open while that category was deleted in another tab, or an old client
// replays a stale id — is treated the same way rather than failing the save:
// the write would otherwise be rejected by the foreign key with an error the
// admin can do nothing about, and losing a whole product form to a stale
// dropdown option is far worse than saving the product uncategorized.
export async function resolveCategoryId(value) {
  const categoryId = cleanString(value);
  if (!categoryId) return null;

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  return category?.id ?? null;
}

// Normalise an admin-supplied ingredient list to a canonical
// "A, B, C" string: split on commas/newlines, trim, drop blanks, re-join. Keeps
// the stored value tidy however the admin pasted it, so the pills on the product
// page never render an empty entry from a trailing comma.
export function cleanIngredientList(value) {
  const parts = String(value || "")
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length ? parts.join(", ") : null;
}

export function readBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

export function readInteger(value, fallback = 0) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : fallback;
}


export function readMoney(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return number.toFixed(2);
}

// Valid HomeSection.type values — keep in sync with the HomeSectionType enum in
// prisma/schema.prisma and the renderer switch in components/HomeSections.js.
export const HOME_SECTION_TYPES = [
  "VIDEO_CAROUSEL",
  "DEAL_GRID",
  "CATEGORY_GRID",
  "PRODUCT_CAROUSEL",
  "PROMO_ADS",
  "REVIEWS",
  "STATS_BAR",
  "BEST_SELLERS",
  "RECENTLY_VIEWED",
];

// Valid HomeSection.placement values — keep in sync with the SectionPlacement
// enum in prisma/schema.prisma. Determines which public page a section renders
// on. HOME is the default for legacy/home sections.
export const SECTION_PLACEMENTS = ["HOME", "PRODUCT", "CATEGORY", "CHECKOUT"];

// Valid HomeSectionItem.metric values for STATS_BAR items. Live metrics are
// computed from the database at render time; "STATIC" shows the item's title as
// plain text (a trust promise like "Free shipping over AED 150").
export const STATS_METRICS = [
  "REGISTERED_CUSTOMERS",
  "PAID_ORDERS",
  "STATIC",
];

export function prismaErrorResponse(error, fallbackMessage) {
  if (error?.code === "P2002") {
    return jsonError("A record with the same unique value already exists.", 409, {
      target: error.meta?.target,
    });
  }

  if (error?.code === "P2025") {
    return jsonError("Record not found.", 404);
  }

  // Foreign key violation — almost always a reference to a row that was deleted
  // between the page loading and the form being submitted.
  if (error?.code === "P2003") {
    return jsonError(
      "One of the linked records no longer exists. Refresh the page and try again.",
      409,
      { field: error.meta?.field_name }
    );
  }

  console.error(error);
  return jsonError(fallbackMessage, 500);
}
