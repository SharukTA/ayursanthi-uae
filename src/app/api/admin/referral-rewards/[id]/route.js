import { prisma } from "@/lib/prisma";
import { jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

// PATCH /api/admin/referral-rewards/:id — resolve a milestone free-product reward.
//   action "SHIPPED"  → dispatched; adminNote holds the tracking number.
//   action "REJECTED" → voided (e.g. the customer was found to be gaming referrals).
// Only a CLAIMED reward (one with a shipping address) can be shipped. Re-checked
// inside the transaction, so a double-click can't ship twice.
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const action = String(body.action || "").toUpperCase();
    const adminNote = body.adminNote ? String(body.adminNote).trim() : null;

    if (!["SHIPPED", "REJECTED"].includes(action)) {
      return jsonError("Invalid action. Must be SHIPPED or REJECTED.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const reward = await tx.referralReward.findUnique({ where: { id } });
      if (!reward) throw new Error("NOT_FOUND");
      if (reward.status === "SHIPPED" || reward.status === "REJECTED") {
        throw new Error("ALREADY_RESOLVED");
      }
      if (action === "SHIPPED" && reward.status !== "CLAIMED") {
        throw new Error("NOT_CLAIMED");
      }

      return tx.referralReward.update({
        where: { id },
        data: { status: action, adminNote, processedAt: new Date() },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      });
    });

    return Response.json({ reward: updated });
  } catch (err) {
    if (err.message === "NOT_FOUND") return jsonError("Referral reward not found.", 404);
    if (err.message === "ALREADY_RESOLVED") {
      return jsonError("This reward has already been resolved.", 409);
    }
    if (err.message === "NOT_CLAIMED") {
      return jsonError("Only a claimed reward (with an address) can be shipped.", 409);
    }
    return prismaErrorResponse(err, "Unable to update the referral reward.");
  }
}
