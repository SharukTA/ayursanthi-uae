import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderOrderInvoice } from "@/lib/invoice";

export const runtime = "nodejs";
// Built from live order data (including any refunds recorded since), so it must
// render per-request rather than being prerendered.
export const dynamic = "force-dynamic";

/**
 * GET /dashboard/orders/[id]/invoice — streams the order's invoice PDF.
 *
 * Ownership is checked before anything is rendered: an order id is a cuid, but
 * guessable-or-not is not an access control model. Admins can pull any invoice
 * so support can resend one on request.
 */
export async function GET(_request, { params }) {
  const session = await getSession();
  if (!session) {
    return new Response("Please log in to download your invoice.", { status: 401 });
  }

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: { userId: true, status: true },
  });

  if (!order) {
    return new Response("Order not found.", { status: 404 });
  }
  if (order.userId !== session.userId && session.role !== "ADMIN") {
    return new Response("This order does not belong to you.", { status: 403 });
  }

  const invoice = await renderOrderInvoice(id);
  if (!invoice) {
    return new Response("Order not found.", { status: 404 });
  }

  return new Response(invoice.buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.filename}"`,
      "Content-Length": String(invoice.buffer.length),
      // Invoices change when a refund lands, and they are per-customer.
      "Cache-Control": "no-store, private",
    },
  });
}
