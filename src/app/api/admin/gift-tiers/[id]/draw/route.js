import { jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";
import { runTierDraw } from "@/lib/gift-draws";

export const runtime = "nodejs";

// POST /api/admin/gift-tiers/:id/draw — run this tier's draw once. For each gift
// line a random eligible customer is drawn (unique per run) and a mirror gift is
// created for each winner's direct referrer. See runTierDraw in lib/gift-draws.
export async function POST(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const result = await runTierDraw(id);
    return Response.json({
      message:
        result.filled === result.lines
          ? `Draw complete — ${result.filled} winner(s) selected.`
          : `Draw complete — ${result.filled} of ${result.lines} gift line(s) filled (not enough eligible customers for the rest).`,
      ...result,
    });
  } catch (err) {
    if (err.message === "TIER_NOT_FOUND") return jsonError("Gift tier not found.", 404);
    if (err.message === "ALREADY_DRAWN") {
      return jsonError("This tier's draw has already been run.", 409);
    }
    if (err.message === "NOT_READY") {
      return jsonError(
        "This tier isn't ready yet — not enough paying customers to reach its milestone.",
        409
      );
    }
    return prismaErrorResponse(err, "Unable to run the draw.");
  }
}
