import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

// List every order for the admin order-management screen, newest first.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      items: true,
    },
  });

  return Response.json({ orders });
}
