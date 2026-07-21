import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGES, EDITABLE_PAGE_SLUGS } from "@/lib/pages";
import { requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

// GET /api/admin/pages — the editable pages with their current content (DB row
// if saved, otherwise the built-in default). Always returns every known slug so
// the admin form can render them all.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  let rows = [];
  try {
    rows = await prisma.page.findMany({
      where: { slug: { in: EDITABLE_PAGE_SLUGS } },
    });
  } catch {
    rows = [];
  }
  const bySlug = Object.fromEntries(rows.map((r) => [r.slug, r]));

  const pages = EDITABLE_PAGE_SLUGS.map((slug) => {
    const d = DEFAULT_PAGES[slug];
    const row = bySlug[slug];
    return {
      slug,
      title: row?.title ?? d.title,
      subtitle: row?.subtitle ?? d.subtitle ?? "",
      body: row?.body ?? d.body,
      isActive: row?.isActive ?? true,
      customized: Boolean(row),
    };
  });

  return Response.json({ pages });
}
