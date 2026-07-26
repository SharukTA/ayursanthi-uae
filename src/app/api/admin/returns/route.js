import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

// Every return request in the store, newest first, for the admin returns desk.
// Optional ?status= filter keeps the open queue separate from the closed ones.
export async function GET(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const status = new URL(request.url).searchParams.get("status");

  const returns = await prisma.returnRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { requestedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          total: true,
          refundedTotal: true,
          paymentStatus: true,
          deliveredAt: true,
          addressSnapshot: true,
        },
      },
      items: {
        include: {
          orderItem: { select: { id: true, productName: true, price: true, quantity: true } },
        },
      },
    },
  });

  return Response.json({ returns });
}
