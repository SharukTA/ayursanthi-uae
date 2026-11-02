import { prisma } from "@/lib/prisma";
import { jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

// For correcting a payout entered by mistake. It removes the record only: a real
// transfer that has already gone out is not undone by this.
export async function DELETE(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id, payoutId } = await params;

    const removed = await prisma.$transaction(async (tx) => {
      // A request this payout settled can no longer read as paid. It is closed rather
      // than reopened, because the owner may already have another one waiting, and they
      // can simply ask again.
      await tx.shopWithdrawal.updateMany({
        where: { payoutId, shopId: id },
        data: { status: "DECLINED" },
      });
      return tx.shopPayout.deleteMany({ where: { id: payoutId, shopId: id } });
    });
    if (removed.count === 0) return jsonError("Payout not found.", 404);

    return Response.json({ success: true });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to remove the payout.");
  }
}
