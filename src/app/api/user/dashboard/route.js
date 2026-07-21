import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const [recentOrders, wallet, referralsCount, totalOrders, totalSpentAgg] = await Promise.all([
      prisma.order.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { items: true },
      }),
      prisma.wallet.findUnique({
        where: { userId: session.userId },
        include: {
          transactions: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      }),
      prisma.user.count({ where: { referredById: session.userId } }),
      prisma.order.count({ where: { userId: session.userId } }),
      prisma.order.aggregate({
        where: { userId: session.userId, paymentStatus: "PAID" },
        _sum: { total: true },
      }),
    ]);

    return Response.json({
      totalOrders,
      totalSpent: Number(totalSpentAgg._sum.total || 0),
      walletBalance: Number(wallet?.balance || 0),
      pendingBalance: Number(wallet?.pendingBalance || 0),
      referralsCount,
      recentOrders,
      recentTransactions: wallet?.transactions || [],
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
