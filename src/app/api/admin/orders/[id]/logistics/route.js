import { prisma } from "@/lib/prisma";
import { jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";
import { sendLogisticsDispatchEmail } from "@/lib/email-logistics";

export const runtime = "nodejs";

// Re-sends the dispatch instruction for one order to the logistics inbox.
//
// The dispatch email goes out on its own when the payment clears
// (lib/order-payment.js). This route is the manual fallback for the case that
// has no other recovery path: the automatic send failed — Resend was down, the
// daily quota was spent, the address bounced — and the order is now sitting
// paid with nobody told to ship it. The admin order list flags exactly those
// orders, and this is the button behind the flag.
//
// Not awaited through queueEmail() like the automatic sends: the admin pressing
// the button needs to be told whether it actually went this time, which is the
// entire point of pressing it.
export async function POST(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        logisticsNotifiedAt: true,
      },
    });
    if (!order) return jsonError("Order not found.", 404);

    // Two guards, both about not shipping goods that shouldn't move. An unpaid
    // order is a stock reservation, and a cancelled one has had its money sent
    // back — a dispatch instruction for either is an instruction to give away
    // stock. The automatic send can never hit these states; a button can.
    if (order.paymentStatus !== "PAID") {
      return jsonError(
        `Order ${order.orderNumber} is not paid, so it must not be sent for dispatch.`,
        409
      );
    }
    if (order.status === "CANCELLED") {
      return jsonError(`Order ${order.orderNumber} is cancelled and must not be shipped.`, 409);
    }

    // `force` re-sends one the logistics team already has. Off by default, so
    // the ordinary press of this button on an already-dispatched order does
    // nothing rather than booking a second parcel; the UI only offers the
    // forced variant once an admin has confirmed they mean it.
    const body = await request.json().catch(() => ({}));
    const force = body?.force === true;

    const result = await sendLogisticsDispatchEmail(order.id, { force });

    if (result.status === "no_recipient") {
      return jsonError(
        "No logistics inbox is configured. Set LOGISTICS_EMAIL and try again.",
        500
      );
    }
    if (result.status === "failed") {
      return jsonError(
        "The email provider rejected the dispatch email. Check the email log and try again.",
        502
      );
    }
    if (result.status === "skipped") {
      return Response.json({
        status: "skipped",
        message: "Logistics already has this order. Nothing was sent.",
        logisticsNotifiedAt: order.logisticsNotifiedAt,
      });
    }

    const updated = await prisma.order.findUnique({
      where: { id: order.id },
      select: { logisticsNotifiedAt: true },
    });

    return Response.json({
      status: "sent",
      message: `Dispatch details for ${order.orderNumber} sent to logistics.`,
      logisticsNotifiedAt: updated?.logisticsNotifiedAt ?? null,
    });
  } catch (err) {
    return prismaErrorResponse(err, "Unable to send this order to logistics.");
  }
}
