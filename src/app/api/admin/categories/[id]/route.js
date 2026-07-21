import { prisma } from "@/lib/prisma";
import {
  cleanString,
  jsonError,
  prismaErrorResponse,
  readBoolean,
  requireAdmin,
  slugify,
} from "@/lib/admin-api";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      parent: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      subcategories: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
        },
      },
      products: {
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          stock: true,
          isActive: true,
        },
      },
    },
  });

  if (!category) {
    return jsonError("Category not found.", 404);
  }

  return Response.json({ category });
}

export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const data = {};

    if ("name" in body) {
      const name = cleanString(body.name);

      if (!name) {
        return jsonError("Category name cannot be empty.");
      }

      data.name = name;
    }

    if ("slug" in body || "name" in body) {
      const slug = slugify(body.slug || body.name);

      if (!slug) {
        return jsonError("Category slug cannot be empty.");
      }

      data.slug = slug;
    }

    if ("description" in body) {
      data.description = cleanString(body.description);
    }

    if ("imageUrl" in body) {
      data.imageUrl = cleanString(body.imageUrl);
    }

    if ("parentId" in body) {
      const parentId = cleanString(body.parentId);

      if (parentId === id) {
        return jsonError("A category cannot be its own parent.");
      }

      data.parentId = parentId;
    }

    if ("isActive" in body) {
      data.isActive = readBoolean(body.isActive, true);
    }

    const category = await prisma.category.update({
      where: { id },
      data,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return Response.json({ category });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to update category.");
  }
}

export async function DELETE(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const category = await prisma.category.update({
      where: { id },
      data: { isActive: false },
    });

    return Response.json({
      category,
      message: "Category disabled successfully.",
    });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to disable category.");
  }
}
