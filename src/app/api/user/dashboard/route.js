import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CUSTOMER_VISIBLE_ORDERS } from "@/lib/order-policy";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const [recentOrders, totalOrders, totalSpentAgg] = await Promise.all([
      prisma.order.findMany({
        // Same filter the orders page uses, or the dashboard would promise five
        // recent orders and link to a list that shows fewer.
        where: { userId: session.userId, ...CUSTOMER_VISIBLE_ORDERS },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { items: true },
      }),
      prisma.order.count({ where: { userId: session.userId, ...CUSTOMER_VISIBLE_ORDERS } }),
      prisma.order.aggregate({
        where: { userId: session.userId, paymentStatus: "PAID" },
        _sum: { total: true },
      }),
    ]);

    return Response.json({
      totalOrders,
      totalSpent: Number(totalSpentAgg._sum.total || 0),
      recentOrders,
    });
  } catch (err) {
    const isDbDown = err?.code === "P1001";
    return Response.json(
      {
        message: isDbDown
          ? "Database is unreachable. Please ensure PostgreSQL is running."
          : "Failed to load dashboard data.",
      },
      { status: 503 }
    );
  }
}
