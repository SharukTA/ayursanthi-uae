import { jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";
import { updateReturnStatus } from "@/lib/order-actions";
import { RETURN_STATUS_TRANSITIONS } from "@/lib/returns";

export const runtime = "nodejs";

const VALID_STATUSES = Object.keys(RETURN_STATUS_TRANSITIONS);

/**
 * Admin moves a return request along: approve it, mark it picked up, mark it
 * received (which puts sellable stock back), then refund or replace.
 *
 * The legal moves live in RETURN_STATUS_TRANSITIONS, so money can never leave
 * before the item is physically back — REFUNDED is only reachable from RECEIVED.
 */
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const status = String(body.status || "").toUpperCase();

    if (!VALID_STATUSES.includes(status)) {
      return jsonError(`Invalid return status. Must be one of: ${VALID_STATUSES.join(", ")}.`);
    }

    const adminNote =
      body.adminNote === undefined ? undefined : String(body.adminNote || "").trim().slice(0, 1000);
    const refundReference =
      body.refundReference === undefined
        ? undefined
        : String(body.refundReference || "").trim().slice(0, 120);

    if (status === "REJECTED" && !adminNote) {
      return jsonError("Add a note explaining why this return is being declined.");
    }

    const result = await updateReturnStatus({ returnId: id, status, adminNote, refundReference });

    if (result.status !== "updated") {
      return jsonError(
        result.message || "Could not update this return.",
        result.status === "not_found" ? 404 : 409
      );
    }

    return Response.json({ request: result.request });
  } catch (err) {
    return prismaErrorResponse(err, "Unable to update the return request.");
  }
}
