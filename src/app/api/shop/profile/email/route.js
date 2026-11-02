import { sendShopEmailChangeCodeEmail } from "@/lib/email-shop";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimitedResponse, RATE_LIMITS } from "@/lib/rate-limit";
import { generateOtp, hashOtp, OTP_EXPIRY_MINUTES } from "@/lib/reset-otp";
import { getCurrentShop, shopCodeMatches } from "@/lib/shop";
import { readJsonObject, validateEmail } from "@/lib/validation";

export const runtime = "nodejs";

const refused = (field, message, status = 400) => Response.json({ field, message }, { status });

const NOT_SIGNED_IN = { message: "Please open your shop again." };

/**
 * Starts an email change: sends a one-time code to the new address. Nothing changes
 * until that code comes back. It is how the store reaches the owner and only they can
 * change it, so a typo here would otherwise cut them off with nobody able to fix it.
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

    const newEmail = typeof body?.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
    const emailError = validateEmail(newEmail);
    if (emailError) return refused("newEmail", emailError);
    if (newEmail === shop.email) return refused("newEmail", "That is already your email.");

    const taken = await prisma.shop.findUnique({ where: { email: newEmail }, select: { id: true } });
    if (taken) return refused("newEmail", "Another shop already uses this email.");

    // Only now, because each one sends an email out of the daily allowance.
    const sendLimit = await consumeRateLimit({
      key: `shop-email-change:shop:${shop.id}`,
      ...RATE_LIMITS.shopEmailChange,
    });
    if (!sendLimit.allowed) {
      return rateLimitedResponse(sendLimit.retryAfter, "Too many codes sent. Please try again later.");
    }

    const otp = generateOtp();
    const pending = {
      newEmail,
      otpHash: hashOtp(otp),
      attempts: 0,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    };
    await prisma.shopEmailChange.upsert({
      where: { shopId: shop.id },
      update: pending,
      create: { shopId: shop.id, ...pending },
    });

    // Awaited, because they are about to wait for this code and need to know if it failed.
    const sent = await sendShopEmailChangeCodeEmail({ ownerName: shop.ownerName, to: newEmail, otp });
    if (!sent?.ok) {
      await prisma.shopEmailChange.deleteMany({ where: { shopId: shop.id } });
      return Response.json({ message: "We could not send a code to that email. Please check it and try again." }, { status: 502 });
    }

    return Response.json({ success: true, expiresInMinutes: OTP_EXPIRY_MINUTES });
  } catch (error) {
    console.error("Shop email change failed:", error);
    return Response.json({ message: "Could not start the change. Please try again." }, { status: 500 });
  }
}

/** Abandons a waiting change. The current email carries on working either way. */
export async function DELETE() {
  try {
    const shop = await getCurrentShop();
    if (!shop) return Response.json(NOT_SIGNED_IN, { status: 401 });

    await prisma.shopEmailChange.deleteMany({ where: { shopId: shop.id } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Cancelling a shop email change failed:", error);
    return Response.json({ message: "Could not cancel the change. Please try again." }, { status: 500 });
  }
}
