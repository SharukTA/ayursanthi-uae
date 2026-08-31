import { prisma } from "@/lib/prisma";
import {
  cleanString,
  jsonError,
  prismaErrorResponse,
  readBoolean,
  readInteger,
  requireAdmin,
} from "@/lib/admin-api";

export const runtime = "nodejs";

// The published prize roadmap — the table customers read on /gifts. Marketing
// content, not draw machinery: nothing here decides who wins anything.

export const TIER_INCLUDE = {
  items: {
    include: { prize: { select: { id: true, name: true, valueNote: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } } },
    orderBy: { sortOrder: "asc" },
  },
};

/**
 * Normalise the item list submitted with a tier.
 *
 * Each entry is {prizeId, quantity}. Duplicates are collapsed rather than
 * rejected — the unique index on (tierId, prizeId) would otherwise turn "the
 * admin picked Smart Watch twice" into a constraint error they can do nothing
 * useful with, when the obvious reading is that they meant one line with the
 * quantities added together.
 */
function normaliseItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];

  const merged = new Map();
  for (const item of rawItems) {
    const prizeId = cleanString(item?.prizeId);
    if (!prizeId) continue;
    const quantity = Math.max(1, readInteger(item?.quantity, 1));
    merged.set(prizeId, (merged.get(prizeId) ?? 0) + quantity);
  }

  return [...merged.entries()].map(([prizeId, quantity], index) => ({
    prizeId,
    quantity,
    sortOrder: index,
  }));
}

/** Reject item rows pointing at prizes that no longer exist. */
async function assertPrizesExist(items) {
  if (items.length === 0) return null;

  const ids = items.map((item) => item.prizeId);
  const found = await prisma.giftPrize.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });

  if (found.length !== ids.length) {
    return jsonError(
      "One of the prizes no longer exists. Refresh the page and try again.",
      409
    );
  }
  return null;
}

// GET /api/admin/gifts/tiers — the whole roadmap, plus the catalogue to pick from.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const [tiers, prizes] = await Promise.all([
    prisma.giftTier.findMany({ orderBy: { sortOrder: "asc" }, include: TIER_INCLUDE }),
    prisma.giftPrize.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return Response.json({ tiers, prizes });
}

// POST /api/admin/gifts/tiers — add a rung to the roadmap.
export async function POST(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();

    const memberCount = readInteger(body.memberCount, -1);
    if (memberCount < 0) {
      return jsonError("Members must be a whole number of 0 or more.");
    }

    const items = normaliseItems(body.items);
    const prizeError = await assertPrizesExist(items);
    if (prizeError) return prizeError;

    let sortOrder = body.sortOrder;
    if (sortOrder === undefined || sortOrder === null || sortOrder === "") {
      const last = await prisma.giftTier.findFirst({
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = (last?.sortOrder ?? -1) + 1;
    } else {
      sortOrder = readInteger(sortOrder, 0);
    }

    const tier = await prisma.giftTier.create({
      data: {
        sortOrder,
        memberCount,
        totalMembers: body.totalMembers === "" || body.totalMembers == null
          ? null
          : readInteger(body.totalMembers, 0),
        targetDays: body.targetDays === "" || body.targetDays == null
          ? null
          : readInteger(body.targetDays, 0),
        totalValueNote: cleanString(body.totalValueNote),
        isActive: readBoolean(body.isActive, true),
        items: { create: items },
      },
      include: TIER_INCLUDE,
    });

    return Response.json({ tier }, { status: 201 });
  } catch (err) {
    return prismaErrorResponse(err, "Could not create the roadmap row.");
  }
}
