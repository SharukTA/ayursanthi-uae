import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      subcategories: true,
      _count: {
        select: { products: true },
      },
    },
  });

  return Response.json({ categories });
}
