import { requireAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { findShopTier } from "@/lib/shop-shared";

export const runtime = "nodejs";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const changes = await prisma.shopInvestmentChange.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      toInvestmentAed: true,
      createdAt: true,
      shop: {
        select: {
          ownerName: true,
          phone: true,
          email: true,
          investmentAed: true,
          commissionRate: true,
        },
      },
    },
  });

  return Response.json({
    changes: changes.map((change) => ({
      id: change.id,
      createdAt: change.createdAt,
      ownerName: change.shop.ownerName,
      phone: change.shop.phone,
      email: change.shop.email,
      currentAed: Number(change.shop.investmentAed),
      currentRate: Number(change.shop.commissionRate),
      requestedAed: Number(change.toInvestmentAed),
      requestedRate: findShopTier(change.toInvestmentAed)?.commissionRate ?? null,
    })),
  });
}
