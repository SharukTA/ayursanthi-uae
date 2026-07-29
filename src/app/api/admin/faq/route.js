import { prisma } from "@/lib/prisma";
import { DEFAULT_FAQS } from "@/lib/pages";
import {
  cleanString,
  jsonError,
  prismaErrorResponse,
  readBoolean,
  readInteger,
  requireAdmin,
} from "@/lib/admin-api";

export const runtime = "nodejs";

// GET /api/admin/faq — all FAQ items (active and inactive) for the admin list.
// `defaults` is the built-in list the public FAQ page falls back to while no
// items exist, so the admin can see exactly what customers are reading today.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const items = await prisma.faqItem.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return Response.json({ items, defaults: DEFAULT_FAQS });
}

// POST /api/admin/faq — create a FAQ item, appended to the end by default.
export async function POST(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const question = cleanString(body.question);
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";

    if (!question || !answer) {
      return jsonError("Question and answer are required.");
    }

    let sortOrder = body.sortOrder;
    if (sortOrder === undefined || sortOrder === null || sortOrder === "") {
      const last = await prisma.faqItem.findFirst({
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = (last?.sortOrder ?? -1) + 1;
    } else {
      sortOrder = readInteger(sortOrder, 0);
    }

    const item = await prisma.faqItem.create({
      data: {
        question,
        answer,
        sortOrder,
        isActive: readBoolean(body.isActive, true),
      },
    });

    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to create FAQ item.");
  }
}
