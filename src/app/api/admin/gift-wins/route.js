import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

// GET /api/admin/gift-wins — every gift-draw win for the admin fulfillment queue.
// CLAIMED rows (address submitted) are the ones ready to ship; WON rows are
// waiting on the winner's address. Newest first.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const wins = await prisma.giftWin.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      tier: { select: { label: true, memberThreshold: true } },
    },
  });
  return Response.json({ wins });
}
