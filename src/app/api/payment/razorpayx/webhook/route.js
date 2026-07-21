import { verifyPayoutWebhookSignature, settlePayout } from "@/lib/payouts";

export const runtime = "nodejs";

/**
 * RazorpayX payout webhook — how an outgoing referral payout is confirmed.
 *
 * A payout is asynchronous: dispatchPayout() hands it to RazorpayX and the request
 * sits at PROCESSING (money still held in Wallet.pendingBalance) until the bank
 * confirms. These events are what close the loop:
 *
 *   payout.processed -> the money really left. Hold cleared, DEBIT recorded.
 *   payout.reversed  -> the bank bounced it (bad account, closed, name mismatch).
 *   payout.failed / payout.rejected -> never sent.
 *     For all three the held amount is returned to the user's available balance, so
 *     a failed transfer never silently eats the customer's earnings.
 *
 * Configure in the RazorpayX Dashboard (this is a SEPARATE webhook from the Payments
 * one, with its own secret — they are different products):
 *   My Account & Settings → Webhooks → Add
 *   URL: https://<your-domain>/api/payment/razorpayx/webhook
 *   Events: payout.processed, payout.reversed, payout.failed, payout.updated
 *   Put the secret in RAZORPAYX_WEBHOOK_SECRET.
 *
 * Deliveries can repeat — settlePayout() is idempotent, and PAID/REJECTED are
 * terminal, so a replay cannot pay or refund twice.
 */
export async function POST(request) {
  const raw = await request.text(); // raw body — signature is over the exact bytes
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyPayoutWebhookSignature({ body: raw, signature })) {
    return Response.json({ message: "Invalid signature." }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ message: "Invalid payload." }, { status: 400 });
  }

  try {
    const payout = event?.payload?.payout?.entity;
    if (!payout?.id || !String(event.event || "").startsWith("payout.")) {
      return Response.json({ received: true, ignored: true });
    }

    await settlePayout({
      payoutId: payout.id,
      status: payout.status,
      // reference_id is the WithdrawalRequest id we set when creating the payout —
      // it lets us settle the right row even before providerPayoutId was stored.
      withdrawalId: payout.reference_id || undefined,
      failureReason: payout.failure_reason || payout.status_details?.description || null,
    });

    return Response.json({ received: true });
  } catch (error) {
    // 500 => RazorpayX retries the delivery, which is what we want: a dropped
    // terminal event would strand the money in pendingBalance.
    console.error("RazorpayX payout webhook error:", error);
    return Response.json({ message: "Webhook processing error." }, { status: 500 });
  }
}
