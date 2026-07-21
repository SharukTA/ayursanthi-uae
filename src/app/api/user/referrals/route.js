import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const COMMISSION_RATE = 0.1;

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const [me, referees] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { referralCode: true },
      }),
      prisma.user.findMany({
        where: { referredById: session.userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
          orders: {
            where: { paymentStatus: "PAID" },
            select: {
              id: true,
              orderNumber: true,
              subtotal: true,
              total: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    const enriched = referees.map((r) => {
      const paidOrders = r.orders || [];
      const totalPurchases = paidOrders.reduce(
        (acc, o) => acc + Number(o.subtotal),
        0
      );
      const commissionEarned = parseFloat(
        (totalPurchases * COMMISSION_RATE).toFixed(2)
      );
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        joinedAt: r.createdAt,
        ordersCount: paidOrders.length,
        totalPurchases: parseFloat(totalPurchases.toFixed(2)),
        commissionEarned,
      };
    });

    const totalCommissionEarned = parseFloat(
      enriched.reduce((acc, r) => acc + r.commissionEarned, 0).toFixed(2)
    );
    const totalPurchasesGenerated = parseFloat(
      enriched.reduce((acc, r) => acc + r.totalPurchases, 0).toFixed(2)
    );

    return Response.json({
      referralCode: me?.referralCode || null,
      referralsCount: enriched.length,
      totalCommissionEarned,
      totalPurchasesGenerated,
      commissionRate: COMMISSION_RATE,
      referees: enriched,
    });
  } catch (err) {
    const isDbDown = err?.code === "P1001";
    return Response.json(
      {
        message: isDbDown
          ? "Database is unreachable. Please ensure PostgreSQL is running."
          : "Failed to load referrals.",
      },
      { status: 503 }
    );
  }
}
