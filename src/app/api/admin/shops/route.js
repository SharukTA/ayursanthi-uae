import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { getShopWithdrawalMinimum } from "@/lib/settings";
import { getShopTotals, serializeShop, SHOP_PUBLIC_FIELDS } from "@/lib/shop";

export const runtime = "nodejs";

// List only. A shop is created by approving a join request, in
// /api/admin/shop-requests/[id], and in no other way.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const shops = await prisma.shop.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      ...SHOP_PUBLIC_FIELDS,
      referredBy: { select: { ownerName: true } },
      _count: { select: { referredShops: true } },
    },
  });
  const [totals, withdrawalMinimum] = await Promise.all([
    getShopTotals(shops.map((shop) => shop.id)),
    getShopWithdrawalMinimum(),
  ]);

  return Response.json({
    withdrawalMinimum,
    shops: shops.map((shop) => ({ ...serializeShop(shop), totals: totals.get(shop.id) })),
  });
}
