import { queueEmail } from "@/lib/email-queue";
import { sendShopEmailChangedNotice } from "@/lib/email-shop";
import { prisma } from "@/lib/prisma";
import { maskEmail, OTP_MAX_ATTEMPTS, otpMatches } from "@/lib/reset-otp";
import { getCurrentShop } from "@/lib/shop";
import { readJsonObject } from "@/lib/validation";

export const runtime = "nodejs";

const refused = (message, status = 400) => Response.json({ field: "otp", message }, { status });

const START_AGAIN = "That code has expired. Please ask for a new one.";

// Thrown to roll back when the code was already used by another request.
class AlreadyUsed extends Error {}

/**
 * Finishes an email change, once the code sent to the new address comes back.
 *
 * The old address is told afterwards, masked, so an owner whose shop was opened by
 * someone else finds out. Their code still works, so the admin can tell them the email
 * now on the shop and replace the code, which puts them back in control.
 */
export async function POST(request) {
  try {
    const shop = await getCurrentShop();
    if (!shop) return Response.json({ message: "Please open your shop again." }, { status: 401 });

    const body = await readJsonObject(request);
    const otp = typeof body?.otp === "string" ? body.otp.trim() : "";

    const pending = await prisma.shopEmailChange.findUnique({ where: { shopId: shop.id } });
    if (!pending || pending.expiresAt <= new Date()) return refused(START_AGAIN);

    if (!otpMatches(otp, pending.otpHash)) {
      const updated = await prisma.shopEmailChange.update({
        where: { shopId: shop.id },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });
      if (updated.attempts >= OTP_MAX_ATTEMPTS) {
        await prisma.shopEmailChange.delete({ where: { shopId: shop.id } });
        return refused("Too many wrong codes. Please ask for a new one.");
      }
      return refused("That code is not right.");
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.shopEmailChange.deleteMany({
        where: { shopId: shop.id, otpHash: pending.otpHash },
      });
      if (claimed.count === 0) throw new AlreadyUsed();
      await tx.shop.update({
        where: { id: shop.id },
        data: { email: pending.newEmail, formerEmails: { push: shop.email } },
        select: { id: true },
      });
    });

    queueEmail(() =>
      sendShopEmailChangedNotice({
        ownerName: shop.ownerName,
        to: shop.email,
        newEmail: maskEmail(pending.newEmail),
      })
    );

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof AlreadyUsed) return refused(START_AGAIN);
    // Another shop took this address while the code was on its way.
    if (error?.code === "P2002") {
      return Response.json({ field: "otp", message: "Another shop now uses this email. Please choose another." }, { status: 409 });
    }
    console.error("Confirming a shop email change failed:", error);
    return Response.json({ message: "Could not change your email. Please try again." }, { status: 500 });
  }
}
