import { prisma } from "@/lib/prisma";
import { jsonError, prismaErrorResponse, readBoolean, requireAdmin } from "@/lib/admin-api";
import { getShopReport, serializeShop, SHOP_PUBLIC_FIELDS } from "@/lib/shop";
import { readShopReportQuery } from "@/lib/shop-shared";
import { readJsonObject } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const shop = await prisma.shop.findUnique({ where: { id }, select: { id: true } });
  if (!shop) return jsonError("Shop not found.", 404);

  const query = readShopReportQuery(Object.fromEntries(new URL(request.url).searchParams));

  return Response.json({ report: await getShopReport(id, { ...query, showReferralEarnings: true }) });
}

// The owner's own details, which only they can change: see /api/shop/profile. Their
// investment changes by approving their request: see /api/admin/shop-investment-changes.
const OWNER_ONLY_FIELDS = ["ownerName", "phone", "email", "investmentAed"];

// Only the active switch can be changed here.
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await readJsonObject(request);
    const data = {};

    if (OWNER_ONLY_FIELDS.some((field) => body[field] !== undefined)) {
      return jsonError("Only the shop owner can change their name, phone, email and investment.", 403);
    }

    if (body.isActive !== undefined) {
      data.isActive = readBoolean(body.isActive, true);
    }

    const shop = await prisma.shop.update({
      where: { id },
      data,
      select: SHOP_PUBLIC_FIELDS,
    });

    return Response.json({ shop: serializeShop(shop) });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to update the shop.");
  }
}
