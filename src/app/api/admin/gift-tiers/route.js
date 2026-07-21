import { prisma } from "@/lib/prisma";
import {
  cleanString,
  jsonError,
  prismaErrorResponse,
  readBoolean,
  readInteger,
  requireAdmin,
} from "@/lib/admin-api";
import { getPayingCustomerCount, tierStatus } from "@/lib/gift-draws";

export const runtime = "nodejs";

// GET /api/admin/gift-tiers — all milestone tiers with their gift lines, the live
// paying-customer count, and each tier's derived status (LOCKED/READY/COMPLETED).
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const [tiers, payingCount] = await Promise.all([
    prisma.giftTier.findMany({
      orderBy: [{ sortOrder: "asc" }, { memberThreshold: "asc" }],
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        _count: { select: { wins: true } },
      },
    }),
    getPayingCustomerCount(),
  ]);

  return Response.json({
    payingCount,
    tiers: tiers.map((tier) => ({ ...tier, status: tierStatus(tier, payingCount) })),
  });
}

// POST /api/admin/gift-tiers — create a milestone tier.
export async function POST(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const memberThreshold = readInteger(body.memberThreshold, 0);
    if (memberThreshold < 1) {
      return jsonError("A member threshold of at least 1 is required.");
    }

    const tier = await prisma.giftTier.create({
      data: {
        memberThreshold,
        label: cleanString(body.label),
        sortOrder: readInteger(body.sortOrder, 0),
        isActive: readBoolean(body.isActive, true),
      },
    });

    return Response.json({ tier }, { status: 201 });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to create gift tier.");
  }
}
