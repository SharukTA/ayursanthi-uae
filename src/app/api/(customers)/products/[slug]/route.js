import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      images: {
        orderBy: { sortOrder: "asc" },
      },
      reviews: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!product || !product.isActive) {
    return Response.json({ message: "Product not found" }, { status: 404 });
  }

  return Response.json({ product });
}