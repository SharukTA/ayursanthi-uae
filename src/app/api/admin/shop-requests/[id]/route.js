import { prisma } from "@/lib/prisma";
import { jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";
import { sendShopApprovedEmail } from "@/lib/email-shop";
import {
  encryptShopCode,
  generateLinkCode,
  generateReferralCode,
  generateShopCode,
  hashShopCode,
  serializeShop,
  SHOP_PUBLIC_FIELDS,
} from "@/lib/shop";
import { findShopTier, validateShopCode } from "@/lib/shop-shared";
import { readJsonObject } from "@/lib/validation";

export const runtime = "nodejs";

const ALREADY_REVIEWED = "This request has already been dealt with. Please reload the page.";

// Thrown to roll the approval back when another admin got there first.
class AlreadyReviewed extends Error {}

/**
 * Decides a join request. Body: { action: "approve", code? } or { action: "decline" }.
 *
 * Approving is the moment the partner comes into existence: it creates the shop and
 * emails them the code. Declining sends nothing, because the admin has already
 * spoken to the applicant by the time either happens.
 */
export async function POST(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await readJsonObject(request);

    if (body?.action === "decline") {
      const declined = await prisma.shopRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "DECLINED", reviewedAt: new Date() },
      });
      if (declined.count === 0) return jsonError(ALREADY_REVIEWED, 409);
      return Response.json({ success: true });
    }

    if (body?.action !== "approve") return jsonError("Unknown action.");

    const joinRequest = await prisma.shopRequest.findUnique({ where: { id } });
    if (!joinRequest) return jsonError("Request not found.", 404);

    const tier = findShopTier(joinRequest.investmentAed);
    if (!tier) return jsonError("This investment amount is no longer offered.");

    const typedCode = String(body.code || "").trim();
    if (typedCode) {
      const codeError = validateShopCode(typedCode, joinRequest);
      if (codeError) return jsonError(codeError);
    }
    const code = typedCode || generateShopCode();

    // All or nothing, claiming the request first, so a code that is already taken
    // leaves it pending and two admins cannot create two shops from one request.
    const shop = await prisma.$transaction(async (tx) => {
      const claimed = await tx.shopRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "APPROVED", reviewedAt: new Date() },
      });
      if (claimed.count === 0) throw new AlreadyReviewed();

      const created = await tx.shop.create({
        data: {
          ownerName: joinRequest.ownerName,
          phone: joinRequest.phone,
          email: joinRequest.email,
          investmentAed: tier.investmentAed,
          commissionRate: tier.commissionRate,
          linkCode: generateLinkCode(),
          referralCode: generateReferralCode(),
          referredByShopId: joinRequest.referrerShopId,
          accessCodeHash: hashShopCode(code),
          accessCodeEncrypted: encryptShopCode(code),
        },
        select: SHOP_PUBLIC_FIELDS,
      });

      await tx.shopRequest.update({ where: { id }, data: { shopId: created.id } });
      return created;
    });

    // Awaited rather than queued, so the admin is told straight away if it failed and
    // the code has to reach the applicant some other way.
    let emailed = false;
    try {
      const sent = await sendShopApprovedEmail({
        ownerName: shop.ownerName,
        email: shop.email,
        code,
      });
      emailed = Boolean(sent?.ok);
    } catch (sendError) {
      console.error("Shop approval email failed:", sendError?.message || sendError);
    }

    return Response.json({
      shop: serializeShop(shop),
      emailed,
      ...(emailed ? {} : { code }),
    });
  } catch (error) {
    if (error instanceof AlreadyReviewed) return jsonError(ALREADY_REVIEWED, 409);
    if (error?.code === "P2002") {
      // Two requests from one email can both be waiting if they were sent at the same
      // moment. This one stays pending, for the admin to decline.
      if (String(error.meta?.target).includes("email")) {
        return jsonError("A shop already exists with this email, so this request cannot be approved.", 409);
      }
      return jsonError("That shop code is already in use. Please choose another.", 409);
    }
    return prismaErrorResponse(error, "Unable to update the request.");
  }
}
