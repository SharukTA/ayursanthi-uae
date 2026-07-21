import { prisma } from "@/lib/prisma";
import {
  cleanString,
  jsonError,
  prismaErrorResponse,
  readInteger,
  requireAdmin,
} from "@/lib/admin-api";

export const runtime = "nodejs";

// POST /api/admin/gift-tiers/:id/items — add a gift line to a tier. `quantity` is
// the number of units the drawn winner (and their referrer) each receive.
export async function POST(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id: tierId } = await params;
    const body = await request.json();
    const name = cleanString(body.name);
    if (!name) return jsonError("A gift name is required.");

    // Place new lines at the end of the tier's current list.
    const last = await prisma.giftTierItem.findFirst({
      where: { tierId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const item = await prisma.giftTierItem.create({
      data: {
        tierId,
        name,
        imageUrl: cleanString(body.imageUrl),
        description: cleanString(body.description),
        quantity: Math.max(1, readInteger(body.quantity, 1)),
        sortOrder: readInteger(body.sortOrder, (last?.sortOrder ?? -1) + 1),
      },
    });

    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to add gift line.");
  }
}
