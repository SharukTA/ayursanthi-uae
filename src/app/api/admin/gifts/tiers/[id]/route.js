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

const TIER_INCLUDE = {
  items: {
    include: { prize: { select: { id: true, name: true, valueNote: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } } },
    orderBy: { sortOrder: "asc" },
  },
};

// Same collapse-duplicates rule as the create route; see the comment there.
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

// PATCH /api/admin/gifts/tiers/[id]
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.giftTier.findUnique({ where: { id } });
    if (!existing) return jsonError("Roadmap row not found.", 404);

    const data = {};
    if (body.memberCount !== undefined) {
      const memberCount = readInteger(body.memberCount, -1);
      if (memberCount < 0) return jsonError("Members must be a whole number of 0 or more.");
      data.memberCount = memberCount;
    }
    if (body.totalMembers !== undefined) {
      data.totalMembers =
        body.totalMembers === "" || body.totalMembers === null
          ? null
          : readInteger(body.totalMembers, 0);
    }
    if (body.targetDays !== undefined) {
      data.targetDays =
        body.targetDays === "" || body.targetDays === null
          ? null
          : readInteger(body.targetDays, 0);
    }
    if (body.totalValueNote !== undefined) data.totalValueNote = cleanString(body.totalValueNote);
    if (body.isActive !== undefined) data.isActive = readBoolean(body.isActive, existing.isActive);
    if (body.sortOrder !== undefined) data.sortOrder = readInteger(body.sortOrder, existing.sortOrder);

    // Items are replaced wholesale when supplied. The editor submits the entire
    // list every time, so a diff would be more code for the same result — and
    // the rows carry nothing (no history, no ids anyone holds) that is worth
    // preserving across an edit.
    if (body.items !== undefined) {
      const items = normaliseItems(body.items);

      if (items.length) {
        const found = await prisma.giftPrize.findMany({
          where: { id: { in: items.map((item) => item.prizeId) } },
          select: { id: true },
        });
        if (found.length !== items.length) {
          return jsonError("One of the prizes no longer exists. Refresh and try again.", 409);
        }
      }

      await prisma.$transaction([
        prisma.giftTierItem.deleteMany({ where: { tierId: id } }),
        prisma.giftTier.update({ where: { id }, data: { ...data, items: { create: items } } }),
      ]);

      const tier = await prisma.giftTier.findUnique({ where: { id }, include: TIER_INCLUDE });
      return Response.json({ tier });
    }

    const tier = await prisma.giftTier.update({ where: { id }, data, include: TIER_INCLUDE });
    return Response.json({ tier });
  } catch (err) {
    return prismaErrorResponse(err, "Could not update the roadmap row.");
  }
}

// DELETE /api/admin/gifts/tiers/[id] — its item rows cascade.
export async function DELETE(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    await prisma.giftTier.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err) {
    return prismaErrorResponse(err, "Could not delete the roadmap row.");
  }
}
