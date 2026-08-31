import { prisma } from "@/lib/prisma";
import {
  cleanString,
  jsonError,
  prismaErrorResponse,
  readBoolean,
  readInteger,
  requireAdmin,
} from "@/lib/admin-api";
import { GIFT_POSTER_PLACEMENTS, normalizePlacement } from "@/lib/gift-shared";

export const runtime = "nodejs";

// The campaign artwork shown on /gifts and on a customer's own gifts screen.
//
// Images only: the poster carries its own copy, so there is nothing here to
// keep in step with the page around it. The one field that is not artwork is
// `placement`, which decides which of the two surfaces it appears on.

// GET /api/admin/gifts/posters — every poster, active and hidden.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const posters = await prisma.giftPoster.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return Response.json({ posters, placements: GIFT_POSTER_PLACEMENTS });
}

// POST /api/admin/gifts/posters — add a poster, appended to the end by default.
export async function POST(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const imageUrl = cleanString(body.imageUrl);
    // The image IS the poster. Without one there is nothing to show, so this is
    // the only required field.
    if (!imageUrl) return jsonError("Upload an image for the poster first.");

    let sortOrder = body.sortOrder;
    if (sortOrder === undefined || sortOrder === null || sortOrder === "") {
      const last = await prisma.giftPoster.findFirst({
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = (last?.sortOrder ?? -1) + 1;
    } else {
      sortOrder = readInteger(sortOrder, 0);
    }

    const poster = await prisma.giftPoster.create({
      data: {
        title: cleanString(body.title),
        imageUrl,
        linkUrl: cleanString(body.linkUrl),
        placement: normalizePlacement(body.placement),
        isActive: readBoolean(body.isActive, true),
        sortOrder,
      },
    });

    return Response.json({ poster }, { status: 201 });
  } catch (err) {
    return prismaErrorResponse(err, "Could not add the poster.");
  }
}
