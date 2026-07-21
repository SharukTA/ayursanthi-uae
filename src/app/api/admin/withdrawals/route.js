import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

// List every withdrawal request for the admin payout screen, newest first.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const withdrawals = await prisma.withdrawalRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  return Response.json({ withdrawals });
}
