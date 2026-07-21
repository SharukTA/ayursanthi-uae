import { prisma } from "@/lib/prisma";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { finalizeRazorpayOrder } from "@/lib/checkout";

export const runtime = "nodejs";

/**
 * Razorpay webhook receiver — the safety net for the "customer paid then closed
 * the tab before /verify ran" case. Configure it in the Razorpay Dashboard:
 *   Settings → Webhooks → Add: https://<your-domain>/api/payment/razorpay/webhook
 *   Active events: payment.captured, payment.failed
 *   Set a secret and put the same value in RAZORPAY_WEBHOOK_SECRET.
 *
 * On localhost, expose the dev server with a tunnel (e.g. `ngrok http 3000`) and
 * register the tunnel URL — Razorpay can't reach localhost directly.
 *
 * We must read the RAW body for signature verification (do not parse first).
 */
export async function POST(request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyRazorpayWebhookSignature({ body: raw, signature })) {
    return Response.json({ message: "Invalid signature." }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ message: "Invalid payload." }, { status: 400 });
  }

  try {
    const entity = event?.payload?.payment?.entity;

    if (event.event === "payment.captured" || event.event === "order.paid") {
      const razorpayOrderId = entity?.order_id;
      const paymentId = entity?.id;
      if (razorpayOrderId && paymentId) {
        const result = await finalizeRazorpayOrder({ razorpayOrderId, paymentId });
        // Log non-success outcomes for reconciliation; still ack so Razorpay
        // doesn't retry terminal business failures forever.
        if (!["created", "already_done"].includes(result.status)) {
          console.warn("Webhook finalize did not create an order:", result.status, razorpayOrderId);
        }
      }
    } else if (event.event === "payment.failed") {
      const razorpayOrderId = entity?.order_id;
      if (razorpayOrderId) {
        // Record the failed attempt — leaves a trail without affecting paid orders.
        await prisma.pendingCheckout.updateMany({
          where: { razorpayOrderId, status: "PENDING" },
          data: {
            status: "FAILED",
            failureReason: entity?.error_description || "Payment failed.",
          },
        });
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    // Unexpected error — return 500 so Razorpay retries the delivery.
    console.error("Razorpay webhook handler error:", error);
    return Response.json({ message: "Webhook processing error." }, { status: 500 });
  }
}
