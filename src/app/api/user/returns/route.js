import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

// Every return the signed-in customer has ever opened, newest first — the data
// behind the "Your Returns" view.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const returns = await prisma.returnRequest.findMany({
    where: { userId: session.userId },
    orderBy: { requestedAt: "desc" },
    include: {
      order: { select: { id: true, orderNumber: true, createdAt: true } },
      items: {
        include: {
          orderItem: {
            select: { id: true, productName: true, price: true, productId: true },
          },
        },
      },
    },
  });

  return Response.json({ returns });
}
