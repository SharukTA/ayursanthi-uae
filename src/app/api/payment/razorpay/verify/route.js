import { getSession } from "@/lib/auth";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { finalizeRazorpayOrder } from "@/lib/checkout";

export const runtime = "nodejs";

/**
 * Step 2 of the Razorpay flow (browser success path).
 * Runs after Razorpay reports a successful payment in the browser. We verify the
 * signature server-side (so a forged callback can't create a paid order), then
 * hand off to the shared finalizer, which creates the order from the trusted
 * PendingCheckout snapshot. The webhook calls the same finalizer, so whichever
 * arrives first creates the order and the other is a no-op.
 */
export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ message: "Unauthorized." }, { status: 401 });
    }
    if (session.role === "ADMIN") {
      return Response.json(
        { message: "Administrator accounts cannot book products." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    // 1. Verify the cryptographic signature returned to the browser.
    const valid = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
    if (!valid) {
      return Response.json(
        { message: "Payment verification failed. Signature mismatch." },
        { status: 400 }
      );
    }

    // 2. Create the order from the trusted snapshot (idempotent, shared with webhook).
    const result = await finalizeRazorpayOrder({
      razorpayOrderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      expectedUserId: session.userId,
    });

    switch (result.status) {
      case "created":
      case "already_done":
        return Response.json({
          success: true,
          message: "Payment verified and order placed.",
          orderNumber: result.order.orderNumber,
          orderId: result.order.id,
        });
      case "not_found":
        return Response.json(
          { message: "Checkout session not found or expired." },
          { status: 400 }
        );
      case "forbidden":
        return Response.json(
          { message: "This payment does not belong to your account." },
          { status: 403 }
        );
      case "not_paid":
        return Response.json(
          { message: `Payment not completed (status: ${result.paymentStatus}).` },
          { status: 400 }
        );
      case "amount_mismatch":
        return Response.json(
          { message: "Paid amount does not match order total." },
          { status: 400 }
        );
      default:
        return Response.json({ message: "Failed to verify payment." }, { status: 400 });
    }
  } catch (error) {
    console.error("Razorpay verification/checkout failed:", error);
    return Response.json(
      { message: error.message || "Failed to verify payment." },
      { status: 400 }
    );
  }
}
