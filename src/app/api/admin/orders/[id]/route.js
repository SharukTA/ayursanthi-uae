import { prisma } from "@/lib/prisma";
import { jsonError, ORDER_STATUSES, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

// Admin updates the fulfillment status of an order (PENDING → … → DELIVERED, or
// CANCELLED). The new status is immediately visible to the customer on their
// dashboard orders page, which reads Order.status.
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const status = String(body.status || "").toUpperCase();

    if (!ORDER_STATUSES.includes(status)) {
      return jsonError(
        `Invalid order status. Must be one of: ${ORDER_STATUSES.join(", ")}.`
      );
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: true,
      },
    });

    return Response.json({ order });
  } catch (err) {
    return prismaErrorResponse(err, "Unable to update order status.");
  }
}
