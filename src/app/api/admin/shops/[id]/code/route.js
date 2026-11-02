import { prisma } from "@/lib/prisma";
import { jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";
import { decryptShopCode, encryptShopCode, generateShopCode, hashShopCode } from "@/lib/shop";
import { validateShopCode } from "@/lib/shop-shared";
import { readJsonObject } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Shows an admin one shop's access code. Its own route, asked for one shop at a time,
 * so the shop list never carries everybody's codes at once.
 *
 * `code` is null when there is nothing readable, and replacing the code fixes that.
 */
export async function GET(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const shop = await prisma.shop.findUnique({
    where: { id },
    select: { accessCodeEncrypted: true },
  });
  if (!shop) return jsonError("Shop not found.", 404);

  return Response.json(
    { code: shop.accessCodeEncrypted ? decryptShopCode(shop.accessCodeEncrypted) : null },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Replaces a shop's access code, for a partner whose code got out. Anyone already
 * signed in with the old code is signed out. The advert link is a separate code and
 * keeps working.
 */
export async function POST(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await readJsonObject(request);

    const owner = await prisma.shop.findUnique({
      where: { id },
      select: { ownerName: true, email: true, phone: true },
    });
    if (!owner) return jsonError("Shop not found.", 404);

    const typedCode = String(body.code || "").trim();
    if (typedCode) {
      const codeError = validateShopCode(typedCode, owner);
      if (codeError) return jsonError(codeError);
    }
    const code = typedCode || generateShopCode();

    await prisma.shop.update({
      where: { id },
      data: {
        accessCodeHash: hashShopCode(code),
        accessCodeEncrypted: encryptShopCode(code),
        sessionsValidFrom: new Date(),
      },
      select: { id: true },
    });

    return Response.json({ code });
  } catch (error) {
    if (error?.code === "P2002") {
      return jsonError("That shop code is already in use. Please choose another.", 409);
    }
    return prismaErrorResponse(error, "Unable to replace the shop code.");
  }
}
