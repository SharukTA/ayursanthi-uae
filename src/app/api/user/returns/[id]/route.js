import { getSession } from "@/lib/auth";
import { withdrawReturnRequest } from "@/lib/order-actions";

export const runtime = "nodejs";

const STATUS_CODES = {
  not_found: 404,
  forbidden: 403,
  not_allowed: 409,
};

/**
 * Customer withdraws a return request they opened ("Cancel return" on Amazon).
 * Allowed only while the item is still with them — once the courier has picked
 * it up the request has to run its course.
 */
export async function PATCH(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Please log in to manage your returns." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    if (String(body.action || "") !== "cancel") {
      return Response.json({ message: "Unsupported action." }, { status: 400 });
    }

    const result = await withdrawReturnRequest({ returnId: id, userId: session.userId });

    if (result.status !== "cancelled") {
      return Response.json(
        { message: result.message || "Could not cancel this return." },
        { status: STATUS_CODES[result.status] ?? 400 }
      );
    }

    return Response.json({
      success: true,
      message: "Return request cancelled. The item stays with you.",
      request: result.request,
    });
  } catch (error) {
    console.error("Return withdrawal failed:", error);
    return Response.json({ message: "Could not cancel this return." }, { status: 500 });
  }
}
