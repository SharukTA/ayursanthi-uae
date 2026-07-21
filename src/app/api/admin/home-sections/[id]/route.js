import { prisma } from "@/lib/prisma";
import {
  cleanString,
  HOME_SECTION_TYPES,
  jsonError,
  prismaErrorResponse,
  readBoolean,
  readInteger,
  requireAdmin,
  SECTION_PLACEMENTS,
} from "@/lib/admin-api";

export const runtime = "nodejs";

const itemInclude = {
  orderBy: { position: "asc" },
  include: {
    product: {
      select: { id: true, name: true, slug: true, price: true, mrp: true },
    },
  },
};

// GET /api/admin/home-sections/:id — a single section with its items.
export async function GET(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const section = await prisma.homeSection.findUnique({
    where: { id },
    include: { items: itemInclude },
  });

  if (!section) {
    return jsonError("Section not found.", 404);
  }

  return Response.json({ section });
}

// PATCH /api/admin/home-sections/:id — update section metadata (title, ordering,
// active state, type). Only provided fields are touched.
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const data = {};

    if ("type" in body) {
      const type = cleanString(body.type);
      if (!type || !HOME_SECTION_TYPES.includes(type)) {
        return jsonError("A valid section type is required.");
      }
      data.type = type;
    }

    if ("placement" in body) {
      const placement = cleanString(body.placement);
      if (!placement || !SECTION_PLACEMENTS.includes(placement)) {
        return jsonError("A valid section placement is required.");
      }
      data.placement = placement;
    }

    if ("title" in body) data.title = cleanString(body.title);
    if ("eyebrow" in body) data.eyebrow = cleanString(body.eyebrow);
    if ("subtitle" in body) data.subtitle = cleanString(body.subtitle);
    if ("position" in body) data.position = readInteger(body.position, 0);
    if ("isActive" in body) data.isActive = readBoolean(body.isActive, true);

    const section = await prisma.homeSection.update({
      where: { id },
      data,
      include: { items: itemInclude },
    });

    return Response.json({ section });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to update section.");
  }
}

// DELETE /api/admin/home-sections/:id — permanently remove a section. Its items
// are removed too (onDelete: Cascade). Unlike categories (which are soft-disabled
// to preserve product links), homepage blocks carry no downstream references, so
// a hard delete keeps the Builder list clean.
export async function DELETE(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    await prisma.homeSection.delete({ where: { id } });

    return Response.json({ message: "Section deleted successfully." });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to delete section.");
  }
}
