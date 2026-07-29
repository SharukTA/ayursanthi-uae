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

export async function GET(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const status = searchParams.get("status");

  const categories = await prisma.category.findMany({
    where: {
      ...(status === "active" ? { isActive: true } : {}),
      ...(status === "inactive" ? { isActive: false } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
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
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  return Response.json({ categories });
}

export async function POST(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const name = cleanString(body.name);
    const baseSlug = slugify(body.slug || body.name);

    if (!name || !baseSlug) {
      return jsonError("Category name is required.");
    }

    // Duplicate names are allowed; the slug gets a "-1", "-2" … suffix instead.
    const slug = await uniqueSlug(baseSlug, "category");

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description: cleanString(body.description),
        imageUrl: cleanString(body.imageUrl),
        // Null (root category) when omitted or when the chosen parent has since
        // been deleted — see resolveCategoryId.
        parentId: await resolveCategoryId(body.parentId),
        isActive: readBoolean(body.isActive, true),
      },
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

    return Response.json({ category }, { status: 201 });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to create category.");
  }
}
