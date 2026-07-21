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

// Section types whose items are generated live (catalog / customer reviews), not
// authored by the admin. Posting items to these is rejected — the renderer
// ignores stored items for them anyway (see lib/page-sections.js). REVIEWS in
// particular must stay 100% customer-written.
const DYNAMIC_SECTION_TYPES = ["CATEGORY_GRID", "PRODUCT_CAROUSEL", "REVIEWS"];

// POST /api/admin/home-sections/:id/items — add a card/slide/tile to a section.
// All content fields are optional and generic; the section's type decides which
// ones get rendered. New items are appended to the end of the section.
export async function POST(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id: sectionId } = await params;
    const body = await request.json();

    // Guard: the parent section must exist.
    const section = await prisma.homeSection.findUnique({
      where: { id: sectionId },
      select: { id: true, type: true },
    });
    if (!section) {
      return jsonError("Section not found.", 404);
    }

    // Guard: dynamic sections (catalog/reviews) are filled live, not by hand.
    if (DYNAMIC_SECTION_TYPES.includes(section.type)) {
      return jsonError(
        "This section is filled automatically and does not accept manually added items.",
        400
      );
    }

    let position = body.position;
    if (position === undefined || position === null || position === "") {
      const last = await prisma.homeSectionItem.findFirst({
        where: { sectionId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      position = (last?.position ?? -1) + 1;
    } else {
      position = readInteger(position, 0);
    }

    const item = await prisma.homeSectionItem.create({
      data: {
        sectionId,
        position,
        isActive: readBoolean(body.isActive, true),
        title: cleanString(body.title),
        subtitle: cleanString(body.subtitle),
        body: cleanString(body.body),
        imageUrl: cleanString(body.imageUrl),
        videoUrl: cleanString(body.videoUrl),
        badge: cleanString(body.badge),
        href: cleanString(body.href),
        metric: cleanString(body.metric),
        productId: cleanString(body.productId),
      },
      include: {
        product: {
          select: { id: true, name: true, slug: true, price: true, mrp: true },
        },
      },
    });

    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to add item.");
  }
}
