import { prisma } from "@/lib/prisma";
import {
  cleanString,
  jsonError,
  prismaErrorResponse,
  readInteger,
  requireAdmin,
} from "@/lib/admin-api";

export const runtime = "nodejs";

// PATCH /api/admin/gift-tier-items/:id — update a gift line (only provided fields).
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const data = {};

    if ("name" in body) {
      const name = cleanString(body.name);
      if (!name) return jsonError("Gift name cannot be empty.");
      data.name = name;
    }
    if ("imageUrl" in body) data.imageUrl = cleanString(body.imageUrl);
    if ("description" in body) data.description = cleanString(body.description);
    if ("quantity" in body) data.quantity = Math.max(1, readInteger(body.quantity, 1));
    if ("sortOrder" in body) data.sortOrder = readInteger(body.sortOrder, 0);

    const item = await prisma.giftTierItem.update({ where: { id }, data });
    return Response.json({ item });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to update gift line.");
  }
}

// DELETE /api/admin/gift-tier-items/:id — remove a gift line. Wins already drawn
// for it keep their snapshotted terms (tierItemId is set null).
export async function DELETE(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    await prisma.giftTierItem.delete({ where: { id } });
    return Response.json({ message: "Gift line deleted." });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to delete gift line.");
  }
}
