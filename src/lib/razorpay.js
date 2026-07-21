import crypto from "crypto";

/**
 * Razorpay helpers — dependency-free (REST API + Node crypto).
 *
 * Set these in .env (use TEST keys from the Razorpay Dashboard while testing):
 *   RAZORPAY_KEY_ID          rzp_test_xxxxxxxx   (server)
 *   RAZORPAY_KEY_SECRET      xxxxxxxxxxxxxxxx    (server, keep secret)
 *   NEXT_PUBLIC_RAZORPAY_KEY_ID  rzp_test_xxxxxxxx (exposed to the browser)
 */

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export function razorpayConfigured() {
  return Boolean(KEY_ID && KEY_SECRET);
}

/**
 * Creates an order on Razorpay. Amount must be the rupee total; we convert to paise.
 * @param {object} args
 * @param {number} args.amount  total in rupees (e.g. 1234.56)
 * @param {string} args.receipt your internal reference (max 40 chars)
 * @param {object} [args.notes] optional key/value metadata
 * @returns {Promise<object>} the Razorpay order object (has `id`, `amount`, ...)
 */
export async function createRazorpayOrder({ amount, receipt, notes }) {
  if (!razorpayConfigured()) {
    throw new Error("Razorpay keys are not configured on the server.");
  }

  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100), // paise
      currency: "INR",
      receipt: receipt?.slice(0, 40),
      notes: notes || {},
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.description || "Failed to create Razorpay order.");
  }
  return data;
}

/**
 * Verifies the signature Razorpay returns to the browser after a successful payment.
 * signature === HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 * @returns {boolean}
 */
export function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  if (!KEY_SECRET || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  // constant-time compare
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Verifies a Razorpay webhook payload. The signature (header `x-razorpay-signature`)
 * is HMAC_SHA256(rawBody, webhook_secret). The raw request body must be passed
 * exactly as received — do NOT JSON.parse + re-stringify first.
 * @returns {boolean}
 */
export function verifyRazorpayWebhookSignature({ body, signature }) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !body || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Fetches a payment from Razorpay to confirm its real status/amount server-side.
 * Used as a second line of defense after signature verification.
 */
export async function fetchRazorpayPayment(paymentId) {
  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.description || "Failed to fetch payment.");
  }
  return data;
}
