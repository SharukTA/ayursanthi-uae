import { queueEmail } from "@/lib/email-queue";
import { sendShopActivityNotice } from "@/lib/email-shop";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimitedResponse, RATE_LIMITS } from "@/lib/rate-limit";
import { getCurrentShop, shopCodeMatches } from "@/lib/shop";
import { normalizePhone, readJsonObject, validateMobile, validateName } from "@/lib/validation";

export const runtime = "nodejs";

const refused = (field, message, status = 400) => Response.json({ field, message }, { status });

const text = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * The owner changing their own name and mobile number. The shop comes from their
 * session, and only these two fields are read, so investment and profit rate cannot be
 * changed this way. Email has its own route, because it is checked first.
 *
 * Asks for the shop code again, so a phone left signed in is not enough.
 */
export async function PATCH(request) {
  try {
    const shop = await getCurrentShop();
    if (!shop) return Response.json({ message: "Please open your shop again." }, { status: 401 });

    const limit = await consumeRateLimit({
      key: `shop-profile:shop:${shop.id}`,
      ...RATE_LIMITS.shopProfile,
    });
    if (!limit.allowed) {
      return rateLimitedResponse(limit.retryAfter, "Too many attempts. Please wait a few minutes and try again.");
    }

    const body = await readJsonObject(request);

    if (!(await shopCodeMatches(shop.id, body?.code))) {
      return refused("code", "That shop code is not right.");
    }

    const ownerName = text(body?.ownerName);
    const nameError = validateName(ownerName);
    if (nameError) return refused("ownerName", nameError);

    const phone = text(body?.phone);
    const phoneError = validateMobile(phone);
    if (phoneError) return refused("phone", phoneError);

    const newPhone = normalizePhone(phone);
    const phoneChanged = newPhone !== shop.phone;

    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        ownerName,
        phone: newPhone,
        ...(phoneChanged ? { formerPhones: { push: shop.phone } } : {}),
      },
      select: { id: true },
    });

    if (phoneChanged || ownerName !== shop.ownerName) {
      queueEmail(() =>
        sendShopActivityNotice({
          ownerName,
          to: shop.email,
          message: phoneChanged
            ? `The details on your shop were changed. The mobile number now ends in ${newPhone.slice(-4)}.`
            : `The name on your shop was changed to ${ownerName}.`,
        })
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Shop profile update failed:", error);
    return Response.json({ message: "Could not save your details. Please try again." }, { status: 500 });
  }
}
