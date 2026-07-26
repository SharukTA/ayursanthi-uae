import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          product: {
            include: { images: { take: 1, orderBy: { sortOrder: "asc" } } },
          },
        },
      },
      // Returns ride along with the order so the page can work out what is still
      // returnable (lib/returns.js) and show the status of anything in flight.
      returns: {
        orderBy: { requestedAt: "desc" },
        include: { items: true },
      },
      // Refund rows only — the customer has no use for the COD placeholder, but
      // "Rs. X refunded on <date>" is exactly what they look for.
      payments: {
        where: { provider: "refund" },
        orderBy: { createdAt: "desc" },
        select: { id: true, amount: true, status: true, createdAt: true, rawResponse: true },
      },
    },
  });

  return Response.json({ orders });
}
