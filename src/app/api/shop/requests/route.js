import { prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-queue";
import { sendShopRequestAdminEmail } from "@/lib/email-shop";
import { clientIp, consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { findReferrerShop } from "@/lib/shop";
import { findShopTier } from "@/lib/shop-shared";
import {
  normalizePhone,
  readJsonObject,
  validateEmail,
  validateMobile,
  validateName,
} from "@/lib/validation";

export const runtime = "nodejs";

// The same answer for a new request, a repeat and a bot.
const received = () => Response.json({ success: true }, { status: 201 });

// `field` lets the form show the message beside the input it is about.
const refused = (field, message, status = 400) =>
  Response.json({ field, message }, { status });

const text = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * The public "join" form. Saves a request for an admin to review and creates nothing
 * else: no shop and no code exist until an admin approves it.
 */
export async function POST(request) {
  try {
    const body = await readJsonObject(request);

    // A field people never see, so only a form-filling bot gives it a value.
    if (body.website) return received();

    const ownerName = text(body.ownerName);
    const rawPhone = text(body.phone);
    const rawEmail = text(body.email);

    const nameError = validateName(ownerName);
    if (nameError) return refused("ownerName", nameError);

    const phoneError = validateMobile(rawPhone);
    if (phoneError) return refused("phone", phoneError);

    const emailError = validateEmail(rawEmail);
    if (emailError) return refused("email", emailError);

    const tier = findShopTier(body.investmentAed);
    if (!tier) return refused("investmentAed", "Please choose an investment amount.");

    const email = rawEmail.toLowerCase();
    const phone = normalizePhone(rawPhone);

    // This does confirm that an email has a shop. Deactivated shops count: their owner
    // should ask for it to be turned back on.
    const existingShop = await prisma.shop.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingShop) {
      return refused(
        "email",
        "A shop already exists with this email. Please use a different email.",
        409
      );
    }

    // Refused rather than ignored, because a mistyped code would silently cost the
    // referrer their share for good. It confirms only that a code is live, and these
    // are random, so they cannot realistically be guessed through this form.
    let referrer = null;
    if (text(body.referralCode)) {
      referrer = await findReferrerShop(text(body.referralCode), { email, phone });
      if (!referrer) {
        return refused(
          "referralCode",
          "That shop referral code is not valid. Please check it or leave it blank."
        );
      }
    }

    // Pressing submit twice should not mean two requests and two emails to the admin.
    const pending = await prisma.shopRequest.findFirst({
      where: { email, status: "PENDING" },
      select: { id: true },
    });
    if (pending) return received();

    const saved = await prisma.shopRequest.create({
      data: {
        ownerName,
        phone,
        email,
        investmentAed: tier.investmentAed,
        referrerShopId: referrer?.id ?? null,
      },
    });

    // Nobody is ever turned away. Past the limit the request still appears in the admin
    // list, and only the email is skipped, to protect the daily allowance that password
    // resets also depend on.
    const emailLimit = await consumeRateLimit({
      key: `shop-request:ip:${clientIp(request)}`,
      ...RATE_LIMITS.shopRequest,
    });
    if (emailLimit.allowed) queueEmail(() => sendShopRequestAdminEmail(saved, referrer));

    return received();
  } catch (error) {
    console.error("Shop request failed:", error);
    return Response.json(
      { message: "Could not send your request. Please try again." },
      { status: 500 }
    );
  }
}
