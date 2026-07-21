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

// PATCH /api/admin/gift-tiers/:id — update a tier (only provided fields).
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const data = {};

    if ("memberThreshold" in body) {
      const memberThreshold = readInteger(body.memberThreshold, 0);
      if (memberThreshold < 1) return jsonError("Member threshold must be at least 1.");
      data.memberThreshold = memberThreshold;
    }
    if ("label" in body) data.label = cleanString(body.label);
    if ("sortOrder" in body) data.sortOrder = readInteger(body.sortOrder, 0);
    if ("isActive" in body) data.isActive = readBoolean(body.isActive, true);

    const tier = await prisma.giftTier.update({ where: { id }, data });
    return Response.json({ tier });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to update gift tier.");
  }
}

// DELETE /api/admin/gift-tiers/:id — remove a tier and its gift lines. Wins
// already drawn keep their snapshotted terms (tierItemId set null; tier relation
// cascades the win too — deleting a drawn tier also removes its win records).
export async function DELETE(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    await prisma.giftTier.delete({ where: { id } });
    return Response.json({ message: "Gift tier deleted." });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to delete gift tier.");
  }
}
