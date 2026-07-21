import { prisma } from "@/lib/prisma";
import { EDITABLE_PAGE_SLUGS } from "@/lib/pages";
import {
  cleanString,
  jsonError,
  prismaErrorResponse,
  readBoolean,
  requireAdmin,
} from "@/lib/admin-api";

export const runtime = "nodejs";

// PUT /api/admin/pages/:slug — upsert the content for an editable page.
export async function PUT(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { slug } = await params;
    if (!EDITABLE_PAGE_SLUGS.includes(slug)) {
      return jsonError("Unknown page.", 404);
    }

    const body = await request.json();
    const title = cleanString(body.title);
    const content = typeof body.body === "string" ? body.body.trim() : "";

    if (!title || !content) {
      return jsonError("Title and body are required.");
    }

    const data = {
      title,
      subtitle: cleanString(body.subtitle),
      body: content,
      isActive: readBoolean(body.isActive, true),
    };

    const page = await prisma.page.upsert({
      where: { slug },
      update: data,
      create: { slug, ...data },
    });

    return Response.json({ page });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to save page.");
  }
}
