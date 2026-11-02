import { cleanString, jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { readJsonObject } from "@/lib/validation";

export const runtime = "nodejs";

const ALREADY_REVIEWED = "This request has already been dealt with. Please reload the page.";

// Thrown to roll back when another admin got there first.
class AlreadyReviewed extends Error {}

/**
 * Decides a withdrawal request. Body: { action: "paid", note? } or { action: "decline" }.
 *
 * "paid" records the payout, and is pressed after the transfer has been sent. So it is
 * not refused if a refund has since cut the balance below the amount: the money has gone
 * and the record must say so, which leaves the balance negative. The admin screen warns
 * before this happens.
 */
export async function POST(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await readJsonObject(request);

    if (body?.action === "decline") {
      const declined = await prisma.shopWithdrawal.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "DECLINED", reviewedAt: new Date() },
      });
      if (declined.count === 0) return jsonError(ALREADY_REVIEWED, 409);
      return Response.json({ success: true });
    }

    if (body?.action !== "paid") return jsonError("Unknown action.");

    const withdrawal = await prisma.shopWithdrawal.findUnique({ where: { id } });
    if (!withdrawal) return jsonError("Request not found.", 404);

    // Claimed first, so two clicks cannot record the same payment twice.
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.shopWithdrawal.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "PAID", reviewedAt: new Date() },
      });
      if (claimed.count === 0) throw new AlreadyReviewed();

      const payout = await tx.shopPayout.create({
        data: {
          shopId: withdrawal.shopId,
          amount: withdrawal.amount,
          note: cleanString(body.note),
        },
        select: { id: true },
      });
      await tx.shopWithdrawal.update({ where: { id }, data: { payoutId: payout.id } });
    });

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof AlreadyReviewed) return jsonError(ALREADY_REVIEWED, 409);
    return prismaErrorResponse(error, "Unable to update the request.");
  }
}
