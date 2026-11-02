import {
  clientIp,
  consumeRateLimit,
  rateLimitedResponse,
  refundRateLimit,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { clearShopSession, findActiveShopByCode, setShopSession } from "@/lib/shop";

export const runtime = "nodejs";

// One message for every kind of "no": unknown, deactivated or badly formed. Telling them
// apart would tell a stranger which codes are real.
const invalidCode = () =>
  Response.json(
    { message: "That shop code is not valid. Please check it and try again." },
    { status: 401 }
  );

/**
 * Opens a partner's shop. The shop code is the whole credential, so one guess is tried
 * against every shop at once, and this limit is what stands in the way of guessing.
 * A correct code gives back only its own attempt, never earlier wrong ones, or a partner
 * could keep guessing other shops' codes by mixing in their own. Answers with nothing
 * about the shop itself, and the page reloads into the shop the new cookie belongs to.
 */
export async function POST(request) {
  try {
    const limitKey = `shop-code:ip:${clientIp(request)}`;
    const limit = await consumeRateLimit({ key: limitKey, ...RATE_LIMITS.shopCode });
    if (!limit.allowed) {
      return rateLimitedResponse(
        limit.retryAfter,
        "Too many attempts. Please wait a few minutes and try again."
      );
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body?.code !== "string" || !body.code.trim()) return invalidCode();

    const shop = await findActiveShopByCode(body.code);
    if (!shop) return invalidCode();

    await refundRateLimit(limitKey);
    await setShopSession(shop.id);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Shop sign-in error:", error);
    return Response.json({ message: "Could not open your shop." }, { status: 500 });
  }
}

export async function DELETE() {
  await clearShopSession();
  return Response.json({ success: true });
}
