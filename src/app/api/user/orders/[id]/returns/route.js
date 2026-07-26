import { getSession } from "@/lib/auth";
import { createReturnRequest } from "@/lib/order-actions";
import { REFUND_METHODS, RETURN_REASONS, RETURN_RESOLUTIONS } from "@/lib/returns";

export const runtime = "nodejs";

const STATUS_CODES = {
  not_found: 404,
  forbidden: 403,
  not_allowed: 409,
};

function cleanRefundDetails(input) {
  if (!input || typeof input !== "object") return null;

  const accountName = String(input.accountName || "").trim().slice(0, 120);
  const bankName = String(input.bankName || "").trim().slice(0, 120);
  const accountNumber = String(input.accountNumber || "").trim().slice(0, 60);

  if (!accountName && !bankName && !accountNumber) return null;
  return { accountName, bankName, accountNumber };
}

/**
 * Customer opens a return (or replacement) request for a delivered order.
 *
 * The body carries selections only — `[{ orderItemId, quantity }]` — plus the
 * reason, what they want back (refund/replacement) and, for a refund on a
 * Cash-on-Delivery order, where the money should go. Every amount is recomputed
 * server-side from the stored order in lib/returns.js.
 */
export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Please log in to request a return." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const reason = String(body.reason || "").trim();
    if (!RETURN_REASONS.some((option) => option.value === reason)) {
      return Response.json({ message: "Please choose a reason for the return." }, { status: 400 });
    }

    const resolution = String(body.resolution || "REFUND").trim();
    if (!RETURN_RESOLUTIONS.some((option) => option.value === resolution)) {
      return Response.json(
        { message: "Choose whether you want a refund or a replacement." },
        { status: 400 }
      );
    }

    const comment = String(body.comment || "").trim().slice(0, 1000);
    if (reason === "OTHER" && !comment) {
      return Response.json(
        { message: "Please describe the problem so we can process your return." },
        { status: 400 }
      );
    }

    let refundMethod = null;
    let refundDetails = null;

    if (resolution === "REFUND") {
      refundMethod = String(body.refundMethod || "").trim();
      if (!REFUND_METHODS.some((option) => option.value === refundMethod)) {
        return Response.json(
          { message: "Please choose how you would like to receive your refund." },
          { status: 400 }
        );
      }

      // Cash on Delivery has no card to reverse, so a bank refund needs a
      // destination from the customer — the same details Amazon asks for.
      if (refundMethod === "BANK_TRANSFER") {
        refundDetails = cleanRefundDetails(body.refundDetails);
        if (!refundDetails?.accountName || !refundDetails?.accountNumber) {
          return Response.json(
            { message: "Enter the account holder name and account number for the transfer." },
            { status: 400 }
          );
        }
      }
    }

    const result = await createReturnRequest({
      orderId: id,
      userId: session.userId,
      selections: Array.isArray(body.items) ? body.items : [],
      reason,
      comment,
      resolution,
      refundMethod,
      refundDetails,
    });

    if (result.status !== "created") {
      return Response.json(
        { message: result.message || "Could not create this return request." },
        { status: STATUS_CODES[result.status] ?? 400 }
      );
    }

    return Response.json({
      success: true,
      message:
        resolution === "REFUND"
          ? `Return requested. Rs. ${result.breakdown.total.toLocaleString()} will be refunded once we receive the item.`
          : "Return requested. We will ship a replacement once we receive the item.",
      request: result.request,
      breakdown: result.breakdown,
    });
  } catch (error) {
    console.error("Return request failed:", error);
    return Response.json({ message: "Could not create this return request." }, { status: 500 });
  }
}
