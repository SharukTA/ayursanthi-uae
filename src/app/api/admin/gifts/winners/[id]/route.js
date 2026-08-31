import { prisma } from "@/lib/prisma";
import { cleanString, jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";
import { GIFT_FULFILMENT_STATUSES } from "@/lib/gift-shared";

export const runtime = "nodejs";

// PATCH /api/admin/gifts/winners/[id] — track handing one prize over.
//
// Fulfilment only. Who won what is decided by the draw and is not editable
// here: a screen that could reassign a prize would make the frozen entry list
// and the recorded result meaningless. The referrer's mirrored row is tracked
// separately from the winner's own, because they are two deliveries to two
// people.
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    const winner = await prisma.giftDrawWinner.findUnique({ where: { id } });
    if (!winner) return jsonError("Winner not found.", 404);

    const data = {};

    if (body.status !== undefined) {
      const status = String(body.status);
      if (!GIFT_FULFILMENT_STATUSES.includes(status)) {
        return jsonError(`Status must be one of: ${GIFT_FULFILMENT_STATUSES.join(", ")}.`);
      }
      data.status = status;
    }

    if (body.notes !== undefined) data.notes = cleanString(body.notes);

    if (Object.keys(data).length === 0) {
      return jsonError("Nothing to update.");
    }

    const updated = await prisma.giftDrawWinner.update({
      where: { id },
      data,
      include: {
        prize: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return Response.json({ winner: updated });
  } catch (err) {
    return prismaErrorResponse(err, "Could not update the winner.");
  }
}
