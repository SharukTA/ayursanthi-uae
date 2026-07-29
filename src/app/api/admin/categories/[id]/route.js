import { prisma } from "@/lib/prisma";
import {
  cleanString,
  jsonError,
  prismaErrorResponse,
  readBoolean,
  requireAdmin,
  resolveCategoryId,
  slugify,
  uniqueSlug,
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
      const baseSlug = slugify(body.slug || body.name);

      if (!baseSlug) {
        return jsonError("Category slug cannot be empty.");
      }

      // Renaming onto a name another category already uses suffixes the slug
      // rather than failing the save. Passing this row's own current slug keeps
      // an existing "-2" stable across unrelated edits.
      const current = await prisma.category.findUnique({
        where: { id },
        select: { slug: true },
      });

      data.slug = await uniqueSlug(baseSlug, "category", {
        excludeId: id,
        currentSlug: current?.slug ?? null,
      });
    }

    if ("description" in body) {
      data.description = cleanString(body.description);
    }

    if ("imageUrl" in body) {
      data.imageUrl = cleanString(body.imageUrl);
    }

    if ("parentId" in body) {
      if (cleanString(body.parentId) === id) {
        return jsonError("A category cannot be its own parent.");
      }

      // A parent that has since been deleted resolves to null (root category)
      // rather than failing the save on a foreign key. Same reasoning as a
      // product's optional category — see resolveCategoryId.
      data.parentId = await resolveCategoryId(body.parentId);
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

// Permanently delete a category.
//
// This is a REAL delete, not the soft-disable it used to be, because a disabled
// category was a dead end: its detail page 404'd, it vanished from every picker,
// yet its products stayed attached to a label nobody could reach or clear.
//
// Nothing is lost with it:
//   • its products are left UNCATEGORIZED (categoryId -> NULL). They stay live,
//     searchable and buyable — a category is only a label, never a requirement.
//     The FK is ON DELETE SET NULL, but we do it explicitly so the response can
//     report how many products were detached.
//   • its subcategories are promoted to root categories rather than deleted, so
//     deleting a parent can never silently take a whole subtree with it.
//
// A category that is already gone returns 200: the caller asked for it to not
// exist, and it doesn't. Making that path an error only ever produces a scary
// toast on a double-click.
export async function DELETE(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const existing = await prisma.category.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!existing) {
      return Response.json({
        category: null,
        detachedProducts: 0,
        message: "Category already deleted.",
      });
    }

    const { detachedProducts } = await prisma.$transaction(async (tx) => {
      const detached = await tx.product.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      });

      await tx.category.updateMany({
        where: { parentId: id },
        data: { parentId: null },
      });

      await tx.category.delete({ where: { id } });

      return { detachedProducts: detached.count };
    });

    return Response.json({
      category: existing,
      detachedProducts,
      message: detachedProducts
        ? `Category deleted. ${detachedProducts} product${
            detachedProducts === 1 ? " is" : "s are"
          } now uncategorized.`
        : "Category deleted successfully.",
    });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to delete category.");
  }
}
