import { prisma } from "@/lib/prisma";
import {
  cleanString,
  jsonError,
  prismaErrorResponse,
  readBoolean,
  readInteger,
  requireAdmin,
} from "@/lib/admin-api";
import { normalizePlacement } from "@/lib/gift-shared";

export const runtime = "nodejs";

// PATCH /api/admin/gifts/posters/[id] — edit one poster.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();

    const existing = await prisma.giftPoster.findUnique({ where: { id } });
    if (!existing) return jsonError("Poster not found.", 404);

    const data = {};

    if (body.imageUrl !== undefined) {
      const imageUrl = cleanString(body.imageUrl);
      // Clearing the image would leave a row that renders nothing. Hiding the
      // poster is the way to take it down, and it is one checkbox away.
      if (!imageUrl) return jsonError("A poster needs an image. Untick Active to hide it instead.");
      data.imageUrl = imageUrl;
    }

    if (body.title !== undefined) data.title = cleanString(body.title);
    if (body.linkUrl !== undefined) data.linkUrl = cleanString(body.linkUrl);
    if (body.placement !== undefined) {
      data.placement = normalizePlacement(body.placement, existing.placement);
    }
    if (body.isActive !== undefined) data.isActive = readBoolean(body.isActive, existing.isActive);
    if (body.sortOrder !== undefined) {
      data.sortOrder = readInteger(body.sortOrder, existing.sortOrder);
    }

    const poster = await prisma.giftPoster.update({ where: { id }, data });
    return Response.json({ poster });
  } catch (err) {
    return prismaErrorResponse(err, "Could not update the poster.");
  }
}

// DELETE /api/admin/gifts/posters/[id]
//
// Unguarded, unlike a prize: nothing references a poster, it carries no history,
// and a campaign that is over is genuinely finished with. The uploaded file
// itself stays in object storage — deleting it here would break any other page
// an admin had pasted the same URL into.
export async function DELETE(request, { params }) {
  const { id } = await params;
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    await prisma.giftPoster.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err) {
    return prismaErrorResponse(err, "Could not delete the poster.");
  }
}
