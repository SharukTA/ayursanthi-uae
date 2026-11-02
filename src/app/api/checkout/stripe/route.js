import { getSession } from "@/lib/auth";
import { placeOrder } from "@/lib/checkout";
import { releasePreviousCheckouts, releaseUnpaidOrder } from "@/lib/order-payment";
import { validateShippingAddress } from "@/lib/address";
import { consumeRateLimit, rateLimitedResponse, RATE_LIMITS } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { resolveAttributedShop } from "@/lib/shop";
import { getSiteOrigin, getStripe, isStripeConfigured, STRIPE_CURRENCY, toFils } from "@/lib/stripe";

export const runtime = "nodejs";

// How long the shopper has on Stripe's page before the reservation lapses.
//
// Stripe requires expires_at to be at least 30 minutes ahead and rejects the
// session otherwise, so asking for exactly 30 sits on the boundary: the seconds
// spent building the request and crossing the network come out of the margin,
// and the call fails intermittently under load. 32 keeps it clear of the floor
// while still being about as long as it is reasonable to hold someone else's
// stock for an order nobody has paid for.
const SESSION_TTL_SECONDS = 32 * 60;

/**
 * Starts an online payment. Creates the order in a reserved state, opens a
 * Stripe-hosted Checkout Session for it, and hands the browser the URL to go to.
 *
 * Nothing is confirmed here — the order is still PENDING/PENDING when this
 * responds. The money is recognised by /api/webhooks/stripe (and, as a
 * belt-and-braces fallback, by the return page), which is the only place the
 * order becomes CONFIRMED/PAID. Doing it any earlier would mark orders paid
 * whenever someone closed Stripe's tab.
 *
 * Amounts are recomputed server-side in lib/checkout.js and the line items sent
 * to Stripe are built from the persisted order, never from the request body, so
 * the price charged is always the price stored.
 */
export async function POST(request) {
  try {
    if (!isStripeConfigured()) {
      return Response.json(
        { message: "Online payment is not available right now. Please try again shortly." },
        { status: 503 }
      );
    }

    const session = await getSession();
    if (!session) {
      return Response.json(
        { message: "Unauthorized. Please log in to complete your checkout." },
        { status: 401 }
      );
    }

    if (session.role === "ADMIN") {
      return Response.json(
        { message: "Administrator accounts cannot book products." },
        { status: 403 }
      );
    }

    // Checked before the body is even read, so a flood costs one indexed lookup
    // and nothing else — no parse, no stock reservation, no call to Stripe.
    //
    // Keyed by account rather than by IP. The route already requires a session,
    // which makes the account the part that cannot be swapped cheaply, and it is
    // the account that wears the consequences of the churn: every call here
    // releases this shopper's previous reservations and books new ones.
    const limit = await consumeRateLimit({
      key: `checkout:user:${session.userId}`,
      ...RATE_LIMITS.checkoutStart,
    });
    if (!limit.allowed) {
      return rateLimitedResponse(
        limit.retryAfter,
        "Too many payment attempts. Please wait a few minutes and try again."
      );
    }

    const body = await request.json();
    const { cart, shippingAddress, cartSource } = body;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return Response.json({ message: "Your cart is empty." }, { status: 400 });
    }

    // The same rules the checkout form applied, from the same module, so the
    // form can never accept an address the server will then turn away.
    const addressError = validateShippingAddress(shippingAddress);
    if (addressError) {
      return Response.json({ message: addressError }, { status: 400 });
    }

    // Anything this shopper started and walked away from is closed out first.
    // Coming back and pressing pay again is the single most common thing to do
    // after bouncing off Stripe's page, and without this each attempt leaves its
    // own reservation standing for half an hour — so on a low-stock product the
    // shopper's own abandoned attempt is what tells them the item is unavailable.
    await releasePreviousCheckouts(session.userId);

    const result = await placeOrder({
      userId: session.userId,
      cart: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      shippingAddress,
      clearAccountCart: cartSource !== "guest" && cartSource !== "buynow",
      cartSource,
      shop: await resolveAttributedShop(),
    });

    if (result.status !== "created") {
      return Response.json(
        { message: result.message || "Could not start your payment." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: result.order.id },
      include: { items: true, payments: true },
    });

    const origin = getSiteOrigin(request);
    const stripe = getStripe();

    let checkoutSession;
    try {
      checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        // No payment_method_types on purpose: leaving it off lets Stripe serve
        // whatever the dashboard's payment method configuration has enabled, so
        // turning Apple Pay or Google Pay on there needs no change here.
        line_items: [
          ...order.items.map((item) => ({
            quantity: item.quantity,
            price_data: {
              currency: STRIPE_CURRENCY,
              unit_amount: toFils(item.price),
              product_data: { name: item.productName },
            },
          })),
          // Delivery as its own line rather than folded into the goods, so the
          // Stripe receipt breaks down the same way the checkout page did.
          ...(Number(order.shipping) > 0
            ? [
                {
                  quantity: 1,
                  price_data: {
                    currency: STRIPE_CURRENCY,
                    unit_amount: toFils(order.shipping),
                    product_data: { name: "Delivery" },
                  },
                },
              ]
            : []),
        ],
        customer_email: session.email || undefined,
        client_reference_id: order.orderNumber,
        // The webhook has nothing but the event to go on, so the order id has to
        // travel with the session. Copied onto the PaymentIntent too, so a
        // payment found in the dashboard names its order without a lookup.
        metadata: { orderId: order.id, orderNumber: order.orderNumber },
        payment_intent_data: {
          description: `Ayurshoppee order ${order.orderNumber}`,
          metadata: { orderId: order.id, orderNumber: order.orderNumber },
        },
        expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        // The order id rides back on the cancel URL so the checkout page can ask
        // for the reservation to be torn down immediately, rather than leaving
        // the stock held until the session times out half an hour later.
        cancel_url: `${origin}/checkout?payment=cancelled&order=${order.id}`,
      });
    } catch (stripeError) {
      // The order exists and is sitting on reserved stock, but there is no way
      // to pay for it. Hand the units straight back rather than leaving a ghost
      // reservation that only the 30-minute expiry would clear.
      await releaseUnpaidOrder({
        orderId: order.id,
        reason: "Could not open a payment session.",
      });
      throw stripeError;
    }

    // Kept for support: an admin looking at a stuck order can paste this
    // straight into the Stripe dashboard.
    const pendingPayment = order.payments.find((payment) => payment.provider === "stripe");
    if (pendingPayment) {
      await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: {
          rawResponse: {
            ...(pendingPayment.rawResponse ?? {}),
            sessionId: checkoutSession.id,
          },
        },
      });
    }

    return Response.json({
      success: true,
      url: checkoutSession.url,
      orderNumber: order.orderNumber,
      orderId: order.id,
    });
  } catch (error) {
    console.error("Stripe checkout session failed:", error);
    return Response.json(
      { message: error.message || "Could not start your payment." },
      { status: 400 }
    );
  }
}
