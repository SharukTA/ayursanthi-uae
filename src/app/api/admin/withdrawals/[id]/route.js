import { prisma } from "@/lib/prisma";
import { jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

/**
 * Admin resolves a PENDING withdrawal request — manual payout flow.
 *
 * The requested amount currently sits in the user's Wallet.pendingBalance (held
 * when they submitted the request). This endpoint clears that hold:
 *
 *   action "PAID"     → admin has sent the money offline. Clear the hold from
 *                       pendingBalance and record a DEBIT WalletTransaction so it
 *                       shows in the user's history. (Money has genuinely left.)
 *   action "REJECTED" → admin declines. Clear the hold from pendingBalance and
 *                       refund the amount back to the available balance.
 *
 * Only PENDING requests can be resolved; resolving is idempotent-safe because we
 * re-check the status inside the transaction.
 */
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const action = String(body.action || "").toUpperCase();
    const adminNote = body.adminNote ? String(body.adminNote).trim() : null;

    if (!["PAID", "REJECTED"].includes(action)) {
      return jsonError("Invalid action. Must be PAID or REJECTED.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const wr = await tx.withdrawalRequest.findUnique({ where: { id } });
      if (!wr) throw new Error("NOT_FOUND");
      // PROCESSING = a RazorpayX payout is in flight. Resolving it by hand here would
      // double-pay when the payout webhook lands, so only RazorpayX may settle it.
      if (wr.status === "PROCESSING") throw new Error("PAYOUT_IN_FLIGHT");
      if (wr.status !== "PENDING") throw new Error("ALREADY_RESOLVED");

      const wallet = await tx.wallet.findUnique({ where: { userId: wr.userId } });
      if (!wallet) throw new Error("WALLET_NOT_FOUND");

      const amount = Number(wr.amount);

      if (action === "PAID") {
        // Release the hold; the money has left the platform.
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { pendingBalance: { decrement: amount } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: "DEBIT",
            amount,
            description: `Withdrawal paid to ${wr.method} (${wr.accountInfo})`,
            referenceType: "WITHDRAWAL",
            referenceId: wr.id,
          },
        });
      } else {
        // Rejected: release the hold and refund the available balance.
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            pendingBalance: { decrement: amount },
            balance: { increment: amount },
          },
        });
      }

      return tx.withdrawalRequest.update({
        where: { id },
        data: {
          status: action,
          adminNote,
          processedAt: new Date(),
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      });
    });

    return Response.json({ withdrawal: updated });
  } catch (err) {
    if (err.message === "NOT_FOUND") return jsonError("Withdrawal request not found.", 404);
    if (err.message === "WALLET_NOT_FOUND") return jsonError("User wallet not found.", 404);
    if (err.message === "PAYOUT_IN_FLIGHT") {
      return jsonError(
        "An automatic RazorpayX payout is already in flight for this request. It will settle itself — resolving it here would pay twice.",
        409
      );
    }
    if (err.message === "ALREADY_RESOLVED") {
      return jsonError("This withdrawal request has already been processed.", 409);
    }
    return prismaErrorResponse(err, "Unable to update withdrawal request.");
  }
}
