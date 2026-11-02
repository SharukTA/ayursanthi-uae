import { readMoney } from "@/lib/admin-api";
import { formatMoney } from "@/lib/currency";
import { queueEmail } from "@/lib/email-queue";
import { sendShopActivityNotice, sendShopWithdrawalAdminEmail } from "@/lib/email-shop";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimitedResponse, RATE_LIMITS } from "@/lib/rate-limit";
import { getShopWithdrawalMinimum } from "@/lib/settings";
import { getCurrentShop, getShopTotals, shopCodeMatches } from "@/lib/shop";
import { readJsonObject } from "@/lib/validation";

export const runtime = "nodejs";

const NOT_SIGNED_IN = { message: "Please open your shop again." };

/**
 * A shop owner asking to be paid. The shop always comes from their session, never from
 * the request. This moves no money: an admin sends the transfer and then marks it paid.
 *
 * Asks for the shop code again, so a phone left signed in is not enough.
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

    if (!(await shopCodeMatches(shop.id, body.code))) {
      return Response.json({ message: "That shop code is not right." }, { status: 400 });
    }

    const amount = Number(readMoney(body.amount));
    if (!amount) {
      return Response.json({ message: "Please enter the amount to withdraw." }, { status: 400 });
    }

    const [totalsById, minimum] = await Promise.all([
      getShopTotals([shop.id]),
      getShopWithdrawalMinimum(),
    ]);
    const { balance } = totalsById.get(shop.id);

    if (balance < minimum) {
      return Response.json(
        { message: `You can withdraw once you have ${formatMoney(minimum)} available.` },
        { status: 400 }
      );
    }
    if (amount > balance) {
      return Response.json(
        { message: `You can withdraw up to ${formatMoney(balance)}.` },
        { status: 400 }
      );
    }

    const withdrawal = await prisma.shopWithdrawal.create({
      data: { shopId: shop.id, amount },
      select: { id: true },
    });

    // Nobody is ever turned away. Past the limit the request still appears in the admin
    // list, and only the emails are skipped, to protect the daily allowance.
    const emailLimit = await consumeRateLimit({
      key: `shop-withdrawal:shop:${shop.id}`,
      ...RATE_LIMITS.shopWithdrawal,
    });
    if (emailLimit.allowed) {
      queueEmail(() => sendShopWithdrawalAdminEmail({ shop, amount, available: balance }));
      queueEmail(() =>
        sendShopActivityNotice({
          ownerName: shop.ownerName,
          to: shop.email,
          message: `A withdrawal of ${formatMoney(amount)} was requested from your shop.`,
        })
      );
    }

    return Response.json({ withdrawal }, { status: 201 });
  } catch (error) {
    // The partial index in the migration: one request waiting per shop.
    if (error?.code === "P2002") {
      return Response.json({ message: "You already have a withdrawal request waiting." }, { status: 409 });
    }
    console.error("Withdrawal request failed:", error);
    return Response.json({ message: "Could not send your request. Please try again." }, { status: 500 });
  }
}

/** Takes back the owner's own waiting request, so they can ask for a different amount. */
export async function DELETE() {
  try {
    const shop = await getCurrentShop();
    if (!shop) return Response.json(NOT_SIGNED_IN, { status: 401 });

    const cancelled = await prisma.shopWithdrawal.updateMany({
      where: { shopId: shop.id, status: "PENDING" },
      data: { status: "CANCELLED", reviewedAt: new Date() },
    });
    if (cancelled.count === 0) {
      return Response.json({ message: "You have no request waiting." }, { status: 409 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Cancelling a withdrawal request failed:", error);
    return Response.json({ message: "Could not cancel your request. Please try again." }, { status: 500 });
  }
}
