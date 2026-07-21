import { getSession } from "@/lib/auth";

export function jsonError(message, status = 400, details = undefined) {
  return Response.json({ message, details }, { status });
}

// Guard for admin-only API routes. Usage:
//   const { error, session } = await requireAdmin();
//   if (error) return error;
// Returns a 403 Response in `error` when the caller is not an authenticated ADMIN.
export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
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

export function cleanString(value) {
  const trimmed = String(value || "").trim();
  return trimmed.length ? trimmed : null;
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
];

// Valid HomeSection.placement values — keep in sync with the SectionPlacement
// enum in prisma/schema.prisma. Determines which public page a section renders
// on. HOME is the default for legacy/home sections.
export const SECTION_PLACEMENTS = ["HOME", "PRODUCT", "CATEGORY", "CHECKOUT"];

// Valid HomeSectionItem.metric values for STATS_BAR items. Live metrics are
// computed from the database at render time; "STATIC" shows the item's title as
// plain text (a trust promise like "Free shipping over Rs. 1000").
export const STATS_METRICS = [
  "REGISTERED_CUSTOMERS",
  "PAID_ORDERS",
  "REWARDED_CUSTOMERS",
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

  console.error(error);
  return jsonError(fallbackMessage, 500);
}
