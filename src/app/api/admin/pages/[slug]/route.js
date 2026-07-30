import { prisma } from "@/lib/prisma";
import {
  ALL_EDITABLE_PAGE_SLUGS,
  OPTIONAL_PAGE_SLUGS,
  TITLE_OPTIONAL_SLUGS,
} from "@/lib/pages";
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
    if (!ALL_EDITABLE_PAGE_SLUGS.includes(slug)) {
      return jsonError("Unknown page.", 404);
    }

    const body = await request.json();
    const title = cleanString(body.title);
    const content = typeof body.body === "string" ? body.body.trim() : "";
    // The About page and its optional sections may be saved with no heading —
    // the block then renders as bare prose. Page.title is non-nullable, so an
    // omitted heading is stored as "" rather than null.
    const titleOptional = TITLE_OPTIONAL_SLUGS.includes(slug);

    if (!content || (!titleOptional && !title)) {
      return jsonError(titleOptional ? "Body text is required." : "Title and body are required.");
    }

    const data = {
      title: title ?? "",
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

// PATCH /api/admin/pages/:slug — toggle visibility of an OPTIONAL section, so a
// block can come off the site without losing its text. Not offered for the core
// pages: /about and /terms always render (falling back to the built-in copy), so
// a hide switch there would read as broken.
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { slug } = await params;
    if (!OPTIONAL_PAGE_SLUGS.includes(slug)) {
      return jsonError("This page cannot be hidden.", 400);
    }

    const body = await request.json();
    const page = await prisma.page.update({
      where: { slug },
      data: { isActive: readBoolean(body.isActive, true) },
    });

    return Response.json({ page });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to update section.");
  }
}

// DELETE /api/admin/pages/:slug — remove an OPTIONAL section entirely, putting
// it back to "not added". Core pages are never deletable.
export async function DELETE(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { slug } = await params;
    if (!OPTIONAL_PAGE_SLUGS.includes(slug)) {
      return jsonError("This page cannot be removed.", 400);
    }

    await prisma.page.delete({ where: { slug } });
    return Response.json({ ok: true });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to remove section.");
  }
}
