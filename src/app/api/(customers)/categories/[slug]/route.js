import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const { slug } = await params;

  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      subcategories: true,
      products: {
        where: { isActive: true },
        include: {
          images: {
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!category) {
    return Response.json({ message: "Category not found" }, { status: 404 });
  }

  return Response.json({ category });
}