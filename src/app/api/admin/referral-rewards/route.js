import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

// GET /api/admin/referral-rewards — the fulfillment queue for the free products
// granted at the referral milestone. CLAIMED rows (address submitted) are ready to
// ship; WON rows are waiting on the customer's address. Newest first.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const rewards = await prisma.referralReward.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          referralMilestoneAt: true,
        },
      },
      product: { select: { id: true, slug: true, stock: true } },
    },
  });

  return Response.json({ rewards });
}
