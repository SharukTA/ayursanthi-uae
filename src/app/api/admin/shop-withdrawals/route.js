import { requireAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { getShopTotals } from "@/lib/shop";

export const runtime = "nodejs";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const withdrawals = await prisma.shopWithdrawal.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      amount: true,
      createdAt: true,
      shop: { select: { id: true, ownerName: true, phone: true, email: true } },
    },
  });
  const totals = await getShopTotals(withdrawals.map((entry) => entry.shop.id));

  return Response.json({
    withdrawals: withdrawals.map((entry) => ({
      ...entry,
      amount: Number(entry.amount),
      available: totals.get(entry.shop.id).balance,
    })),
  });
}
