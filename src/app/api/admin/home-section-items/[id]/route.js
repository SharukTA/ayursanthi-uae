import { prisma } from "@/lib/prisma";
import {
  cleanString,
  prismaErrorResponse,
  readBoolean,
  readInteger,
  requireAdmin,
} from "@/lib/admin-api";

export const runtime = "nodejs";

// PATCH /api/admin/home-section-items/:id — update a single item. Only provided
// fields are changed. Passing an empty string clears an optional field.
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const data = {};

    if ("title" in body) data.title = cleanString(body.title);
    if ("subtitle" in body) data.subtitle = cleanString(body.subtitle);
    if ("body" in body) data.body = cleanString(body.body);
    if ("imageUrl" in body) data.imageUrl = cleanString(body.imageUrl);
    if ("videoUrl" in body) data.videoUrl = cleanString(body.videoUrl);
    if ("badge" in body) data.badge = cleanString(body.badge);
    if ("href" in body) data.href = cleanString(body.href);
    if ("metric" in body) data.metric = cleanString(body.metric);
    if ("productId" in body) data.productId = cleanString(body.productId);
    if ("position" in body) data.position = readInteger(body.position, 0);
    if ("isActive" in body) data.isActive = readBoolean(body.isActive, true);

    const item = await prisma.homeSectionItem.update({
      where: { id },
      data,
      include: {
        product: {
          select: { id: true, name: true, slug: true, price: true, mrp: true },
        },
      },
    });

    return Response.json({ item });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to update item.");
  }
}

// DELETE /api/admin/home-section-items/:id — permanently remove a single item.
export async function DELETE(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    await prisma.homeSectionItem.delete({ where: { id } });

    return Response.json({ message: "Item deleted successfully." });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to delete item.");
  }
}
