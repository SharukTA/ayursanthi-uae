import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createRazorpayOrder, razorpayConfigured } from "@/lib/razorpay";
import { validatePhone } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Step 1 of the Razorpay flow.
 * Validates the cart + address, computes the authoritative total on the server,
 * creates a Razorpay order, and stores a priced PendingCheckout snapshot keyed by
 * the Razorpay order id. No stock is touched yet — the order is created (from the
 * snapshot) only after payment, by ../verify OR the webhook. See lib/checkout.js.
 */
export async function POST(request) {
  try {
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

    if (!razorpayConfigured()) {
      return Response.json(
        { message: "Online payment is not configured. Please contact the store." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { cart, shippingAddress } = body;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return Response.json({ message: "Your cart is empty." }, { status: 400 });
    }

    if (
      !shippingAddress ||
      !shippingAddress.fullName ||
      !shippingAddress.phone ||
      !shippingAddress.line1 ||
      !shippingAddress.city ||
      !shippingAddress.state ||
      !shippingAddress.postalCode
    ) {
      return Response.json(
        { message: "Please provide all required shipping address fields." },
        { status: 400 }
      );
    }

    // Re-validate the phone server-side so a hand-crafted request can't store an
    // unusable delivery / payment contact number.
    const phoneError = validatePhone(shippingAddress.phone, { required: true });
    if (phoneError) {
      return Response.json({ message: phoneError }, { status: 400 });
    }

    // Recompute everything from DB prices — never trust amounts sent by the client.
    // We build a fully-priced snapshot so the order can later be created from
    // trusted data by either the browser or the webhook.
    let subtotal = 0;
    const items = [];
    for (const item of cart) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product || !product.isActive) {
        return Response.json(
          { message: "One or more products are unavailable." },
          { status: 400 }
        );
      }
      if (product.stock < item.quantity) {
        return Response.json(
          { message: `Insufficient stock for "${product.name}".` },
          { status: 400 }
        );
      }
      const price = Number(product.price);
      const lineTotal = price * item.quantity;
      subtotal += lineTotal;
      items.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        price,
        total: lineTotal,
      });
    }

    const tax = parseFloat((subtotal * 0.18).toFixed(2));
    const shipping = subtotal >= 1000 ? 0.0 : 99.0;
    const total = parseFloat((subtotal + tax + shipping).toFixed(2));

    const order = await createRazorpayOrder({
      amount: total,
      receipt: `rcpt_${session.userId.slice(-8)}_${Date.now().toString().slice(-8)}`,
      notes: { userId: session.userId },
    });

    // Persist the priced snapshot so /verify and the webhook can both create the
    // order from trusted server-side data (idempotently).
    await prisma.pendingCheckout.create({
      data: {
        razorpayOrderId: order.id,
        userId: session.userId,
        items,
        subtotal,
        tax,
        shipping,
        total,
        shippingAddress,
      },
    });

    return Response.json({
      success: true,
      razorpayOrderId: order.id,
      amount: order.amount, // paise
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Razorpay order creation failed:", error);
    return Response.json(
      { message: error.message || "Failed to start payment." },
      { status: 400 }
    );
  }
}
