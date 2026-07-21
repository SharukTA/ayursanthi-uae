import { prisma } from "@/lib/prisma";
import { jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

// PATCH /api/admin/gift-wins/:id — resolve a gift-draw win.
//   action "SHIPPED"  → admin dispatched it; adminNote holds the tracking number.
//   action "REJECTED" → admin voided the win (e.g. ineligible on review).
// Only a CLAIMED win (with an address) can be shipped; rejection is allowed from
// WON or CLAIMED. Re-checked inside the transaction so the action is idempotent.
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
      const win = await tx.giftWin.findUnique({ where: { id } });
      if (!win) throw new Error("NOT_FOUND");
      if (win.status === "SHIPPED" || win.status === "REJECTED") {
        throw new Error("ALREADY_RESOLVED");
      }
      if (action === "SHIPPED" && win.status !== "CLAIMED") {
        throw new Error("NOT_CLAIMED");
      }

      return tx.giftWin.update({
        where: { id },
        data: { status: action, adminNote, processedAt: new Date() },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      });
    });

    return Response.json({ win: updated });
  } catch (err) {
    if (err.message === "NOT_FOUND") return jsonError("Gift win not found.", 404);
    if (err.message === "ALREADY_RESOLVED") {
      return jsonError("This gift win has already been resolved.", 409);
    }
    if (err.message === "NOT_CLAIMED") {
      return jsonError("Only a claimed gift (with an address) can be shipped.", 409);
    }
    return prismaErrorResponse(err, "Unable to update gift win.");
  }
}
