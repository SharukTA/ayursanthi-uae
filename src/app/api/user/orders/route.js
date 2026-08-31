import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CUSTOMER_VISIBLE_ORDERS } from "@/lib/order-policy";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { userId: session.userId, ...CUSTOMER_VISIBLE_ORDERS },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          product: {
            include: { images: { take: 1, orderBy: { sortOrder: "asc" } } },
          },
        },
      },
      // Refund rows only — the customer has no use for the payment placeholder,
      // but "AED X refunded on <date>" is exactly what they look for.
      payments: {
        where: { provider: "refund" },
        orderBy: { createdAt: "desc" },
        select: { id: true, amount: true, status: true, createdAt: true, rawResponse: true },
      },
    },
  });

  return Response.json({ orders });
}
