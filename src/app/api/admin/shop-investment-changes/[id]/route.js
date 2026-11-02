import { jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { findShopTier } from "@/lib/shop-shared";
import { readJsonObject } from "@/lib/validation";

export const runtime = "nodejs";

const ALREADY_REVIEWED = "This request has already been dealt with. Please reload the page.";

// Thrown to roll back when another admin got there first.
class AlreadyReviewed extends Error {}

/**
 * Decides an investment request. Body: { action: "approve" } or { action: "decline" }.
 *
 * Approving is the only way a shop's investment and profit rate change. The rate is read
 * from the current plan at this moment, and past sales keep the rate they were made at:
 * see ShopSale.rate. Declining leaves the shop exactly as it was.
 */
export async function POST(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await readJsonObject(request);

    if (body?.action === "decline") {
      const declined = await prisma.shopInvestmentChange.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "DECLINED", reviewedAt: new Date() },
      });
      if (declined.count === 0) return jsonError(ALREADY_REVIEWED, 409);
      return Response.json({ success: true });
    }

    if (body?.action !== "approve") return jsonError("Unknown action.");

    const change = await prisma.shopInvestmentChange.findUnique({ where: { id } });
    if (!change) return jsonError("Request not found.", 404);

    const tier = findShopTier(change.toInvestmentAed);
    if (!tier) return jsonError("This investment amount is no longer offered.");

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.shopInvestmentChange.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "APPROVED", reviewedAt: new Date() },
      });
      if (claimed.count === 0) throw new AlreadyReviewed();

      await tx.shop.update({
        where: { id: change.shopId },
        data: { investmentAed: tier.investmentAed, commissionRate: tier.commissionRate },
        select: { id: true },
      });
    });

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof AlreadyReviewed) return jsonError(ALREADY_REVIEWED, 409);
    return prismaErrorResponse(error, "Unable to update the request.");
  }
}
