import { confirmPaidOrder, releaseUnpaidOrder } from "@/lib/order-payment";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Stripe's callback, and the authority on whether an order was paid.
 *
 * The shopper's browser is not trusted to report this: it may never come back
 * from Stripe's page at all — closed tab, dead battery, a wallet payment that
 * settles minutes later. Stripe retries this endpoint until it gets a 2xx, so
 * the order gets confirmed either way.
 *
 * Anyone can POST here, so the signature check below is the whole security
 * boundary: without it a forged "payment succeeded" would confirm any order.
 * It needs the exact bytes Stripe sent, which is why the body is read with
 * request.text() and parsed by Stripe rather than by request.json().
 *
 * Register the endpoint at https://dashboard.stripe.com/webhooks as
 * <site>/api/webhooks/stripe, subscribed to the four events handled below, and
 * put its signing secret in STRIPE_WEBHOOK_SECRET. Test mode and live mode have
 * separate endpoints with different secrets.
 */
export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set.");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event;
  try {
    const payload = await request.text();
    event = await getStripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch (error) {
    // Bad signature, or a body that was altered in transit. 400 tells Stripe not
    // to bother retrying — a forged call is not going to verify next time either.
    console.error("Stripe webhook signature verification failed:", error.message);
    return new Response(`Webhook error: ${error.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      // The ordinary success path for cards and wallets.
      case "checkout.session.completed": {
        const session = event.data.object;
        // Delayed methods land here still unpaid and settle later via
        // async_payment_succeeded; confirming now would mark them paid early.
        if (session.payment_status === "paid") {
          await handleSuccess(session);
        }
        break;
      }

      // Slower payment methods finishing after the shopper already left.
      case "checkout.session.async_payment_succeeded": {
        await handleSuccess(event.data.object);
        break;
      }

      case "checkout.session.async_payment_failed": {
        await handleRelease(event.data.object, "The online payment failed.");
        break;
      }

      // The 30-minute window elapsed without payment. This is what puts
      // abandoned checkouts' stock back on the shelf.
      case "checkout.session.expired": {
        await handleRelease(event.data.object, "The payment session expired.");
        break;
      }

      default:
        // Everything else is subscribed by accident or by a future change;
        // acknowledging it stops Stripe retrying an event nothing acts on.
        break;
    }
  } catch (error) {
    // A 500 makes Stripe retry with backoff, which is what we want for a
    // transient database failure — the order must not stay unconfirmed.
    console.error(`Stripe webhook handler failed for ${event.type}:`, error);
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

function orderIdFrom(session) {
  const orderId = session?.metadata?.orderId;
  if (!orderId) {
    console.error(`Stripe session ${session?.id} arrived with no orderId in metadata.`);
  }
  return orderId || null;
}

async function handleSuccess(session) {
  const orderId = orderIdFrom(session);
  if (!orderId) return;

  await confirmPaidOrder({
    orderId,
    sessionId: session.id,
    paymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id,
    raw: {
      source: "webhook",
      amountTotal: session.amount_total,
      currency: session.currency,
    },
  });
}

async function handleRelease(session, reason) {
  const orderId = orderIdFrom(session);
  if (!orderId) return;

  await releaseUnpaidOrder({ orderId, reason });
}
