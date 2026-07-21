import { prisma } from "@/lib/prisma";
import {
  cleanString,
  jsonError,
  prismaErrorResponse,
  readBoolean,
  readInteger,
  requireAdmin,
} from "@/lib/admin-api";

export const runtime = "nodejs";

// PATCH /api/admin/faq/:id — update a FAQ item (only provided fields).
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const data = {};

    if ("question" in body) {
      const question = cleanString(body.question);
      if (!question) return jsonError("Question cannot be empty.");
      data.question = question;
    }
    if ("answer" in body) {
      const answer = typeof body.answer === "string" ? body.answer.trim() : "";
      if (!answer) return jsonError("Answer cannot be empty.");
      data.answer = answer;
    }
    if ("sortOrder" in body) data.sortOrder = readInteger(body.sortOrder, 0);
    if ("isActive" in body) data.isActive = readBoolean(body.isActive, true);

    const item = await prisma.faqItem.update({ where: { id }, data });
    return Response.json({ item });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to update FAQ item.");
  }
}

// DELETE /api/admin/faq/:id — remove a FAQ item.
export async function DELETE(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    await prisma.faqItem.delete({ where: { id } });
    return Response.json({ message: "FAQ item deleted." });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to delete FAQ item.");
  }
}
