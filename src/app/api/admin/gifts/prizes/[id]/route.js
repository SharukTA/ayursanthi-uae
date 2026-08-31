import { prisma } from "@/lib/prisma";
import {
  cleanString,
  jsonError,
  prismaErrorResponse,
  readBoolean,
  readImageList,
  readInteger,
  requireAdmin,
  uniqueSlug,
} from "@/lib/admin-api";

export const runtime = "nodejs";

// PATCH /api/admin/gifts/prizes/[id] — edit one catalogue entry.
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.giftPrize.findUnique({ where: { id } });
    if (!existing) return jsonError("Prize not found.", 404);

    const data = {};

    if (body.name !== undefined) {
      const name = cleanString(body.name);
      if (!name) return jsonError("A prize name is required.");
      data.name = name;
      // Only re-derive the slug when the name actually moved. Renaming a prize
      // must not silently renumber a slug that is stable everywhere else.
      if (name !== existing.name) {
        data.slug = await uniqueSlug(name, "giftPrize", {
          excludeId: id,
          currentSlug: existing.slug,
        });
      }
    }

    if (body.valueNote !== undefined) data.valueNote = cleanString(body.valueNote);
    if (body.isActive !== undefined) data.isActive = readBoolean(body.isActive, existing.isActive);
    if (body.isFeatured !== undefined)
      data.isFeatured = readBoolean(body.isFeatured, existing.isFeatured);
    if (body.sortOrder !== undefined) data.sortOrder = readInteger(body.sortOrder, existing.sortOrder);

    // The gallery is replaced wholesale rather than diffed. The form always
    // submits the complete list in the order the admin arranged it, so working
    // out which rows moved would be more code for exactly the same result — and
    // the sortOrder of every surviving row has to be rewritten either way.
    // Wrapped with the update so a prize can never be left with the old name and
    // the new pictures, or vice versa.
    const replaceImages = body.images !== undefined;
    const images = replaceImages ? readImageList(body.images) : [];

    const prize = await prisma.$transaction(async (tx) => {
      if (replaceImages) {
        await tx.giftPrizeImage.deleteMany({ where: { prizeId: id } });
        if (images.length > 0) {
          await tx.giftPrizeImage.createMany({
            data: images.map((url, index) => ({ prizeId: id, url, sortOrder: index })),
          });
        }
      }

      return tx.giftPrize.update({
        where: { id },
        data,
        include: { images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true } } },
      });
    });

    return Response.json({ prize });
  } catch (err) {
    return prismaErrorResponse(err, "Could not update the prize.");
  }
}

// DELETE /api/admin/gifts/prizes/[id]
//
// Refused outright once anything references the prize. The foreign keys are
// RESTRICT, so the database would reject it anyway — but a checked refusal can
// say WHICH of the three things is holding it (a roadmap row, a draw, a prize
// somebody has actually won) and suggest deactivating instead, where a raw
// constraint error would just read "operation failed".
export async function DELETE(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const prize = await prisma.giftPrize.findUnique({
      where: { id },
      include: { _count: { select: { tierItems: true, drawPrizes: true, winners: true } } },
    });
    if (!prize) return jsonError("Prize not found.", 404);

    const { tierItems, drawPrizes, winners } = prize._count;
    if (tierItems || drawPrizes || winners) {
      const used = [
        tierItems && `${tierItems} roadmap row${tierItems === 1 ? "" : "s"}`,
        drawPrizes && `${drawPrizes} draw${drawPrizes === 1 ? "" : "s"}`,
        winners && `${winners} recorded win${winners === 1 ? "" : "s"}`,
      ].filter(Boolean);

      return jsonError(
        `"${prize.name}" is still used by ${used.join(", ")}. Deactivate it instead — ` +
          `that hides it from new draws while leaving the history intact.`,
        409
      );
    }

    await prisma.giftPrize.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err) {
    return prismaErrorResponse(err, "Could not delete the prize.");
  }
}
