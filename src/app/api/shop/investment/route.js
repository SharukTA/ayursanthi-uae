import { queueEmail } from "@/lib/email-queue";
import { sendShopActivityNotice, sendShopInvestmentChangeAdminEmail } from "@/lib/email-shop";
import { formatMoney } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimitedResponse, RATE_LIMITS } from "@/lib/rate-limit";
import { getCurrentShop, shopCodeMatches } from "@/lib/shop";
import { findShopTier } from "@/lib/shop-shared";
import { readJsonObject } from "@/lib/validation";

export const runtime = "nodejs";

const refused = (field, message, status = 400) => Response.json({ field, message }, { status });

const NOT_SIGNED_IN = { message: "Please open your shop again." };

/**
 * A shop owner asking to change their investment. This changes nothing on the shop: their
 * amount and profit rate stay as they are unless an admin approves, which they do after
 * the money has been sorted out outside this system.
 */
export async function POST(request) {
  try {
    const shop = await getCurrentShop();
    if (!shop) return Response.json(NOT_SIGNED_IN, { status: 401 });

    const attemptLimit = await consumeRateLimit({
      key: `shop-profile:shop:${shop.id}`,
      ...RATE_LIMITS.shopProfile,
    });
    if (!attemptLimit.allowed) {
      return rateLimitedResponse(attemptLimit.retryAfter, "Too many attempts. Please wait a few minutes and try again.");
    }

    const body = await readJsonObject(request);

    if (!(await shopCodeMatches(shop.id, body?.code))) {
      return refused("code", "That shop code is not right.");
    }

    const tier = findShopTier(body?.investmentAed);
    if (!tier) return refused("investmentAed", "Please choose an investment amount.");
    if (tier.investmentAed === shop.investmentAed) {
      return refused("investmentAed", "That is already your investment.");
    }

    await prisma.shopInvestmentChange.create({
      data: {
        shopId: shop.id,
        fromInvestmentAed: shop.investmentAed,
        toInvestmentAed: tier.investmentAed,
      },
      select: { id: true },
    });

    // Nobody is ever turned away. Past the limit the request still appears in the admin
    // list, and only the emails are skipped, to protect the daily allowance.
    const emailLimit = await consumeRateLimit({
      key: `shop-investment:shop:${shop.id}`,
      ...RATE_LIMITS.shopInvestmentChange,
    });
    if (emailLimit.allowed) {
      queueEmail(() => sendShopInvestmentChangeAdminEmail({ shop, tier }));
      queueEmail(() =>
        sendShopActivityNotice({
          ownerName: shop.ownerName,
          to: shop.email,
          message: `A request was sent from your shop to change your investment to ${formatMoney(tier.investmentAed, { decimals: 0 })}.`,
        })
      );
    }

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    // The partial index in the migration: one request waiting per shop.
    if (error?.code === "P2002") {
      return Response.json({ message: "You already have an investment request waiting." }, { status: 409 });
    }
    console.error("Investment change request failed:", error);
    return Response.json({ message: "Could not send your request. Please try again." }, { status: 500 });
  }
}

/** Takes back the owner's own waiting request. */
export async function DELETE() {
  try {
    const shop = await getCurrentShop();
    if (!shop) return Response.json(NOT_SIGNED_IN, { status: 401 });

    const cancelled = await prisma.shopInvestmentChange.updateMany({
      where: { shopId: shop.id, status: "PENDING" },
      data: { status: "CANCELLED", reviewedAt: new Date() },
    });
    if (cancelled.count === 0) {
      return Response.json({ message: "You have no request waiting." }, { status: 409 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Cancelling an investment change failed:", error);
    return Response.json({ message: "Could not cancel your request. Please try again." }, { status: 500 });
  }
}
