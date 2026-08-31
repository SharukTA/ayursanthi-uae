import { prisma } from "@/lib/prisma";
import {
  cleanString,
  jsonError,
  prismaErrorResponse,
  readBoolean,
  readImageList,
  readInteger,
  requireAdmin,
  uniqueSlug,
} from "@/lib/admin-api";

export const runtime = "nodejs";

// The prize catalogue. One list, two consumers: the published roadmap table on
// /gifts (GiftTierItem) and the pool of an individual monthly draw
// (GiftDrawPrize). Deleting is guarded in [id]/route.js precisely because both
// point here.

// GET /api/admin/gifts/prizes — the whole catalogue, active and inactive.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const prizes = await prisma.giftPrize.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      // Ordered, because the first image is the cover every card and email
      // shows — an unordered gallery would change which one that is between
      // requests.
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true } },
      _count: { select: { tierItems: true, drawPrizes: true, winners: true } },
    },
  });

  return Response.json({ prizes });
}

// POST /api/admin/gifts/prizes — add a prize, appended to the end by default.
export async function POST(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const name = cleanString(body.name);
    if (!name) return jsonError("A prize name is required.");

    let sortOrder = body.sortOrder;
    if (sortOrder === undefined || sortOrder === null || sortOrder === "") {
      const last = await prisma.giftPrize.findFirst({
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = (last?.sortOrder ?? -1) + 1;
    } else {
      sortOrder = readInteger(sortOrder, 0);
    }

    const images = readImageList(body.images);

    const prize = await prisma.giftPrize.create({
      data: {
        name,
        // Prize names repeat across the roadmap ("Smart Watch" is in eight
        // tiers) but each catalogue entry is still one row, so the slug only
        // has to survive an admin adding a near-duplicate by hand.
        slug: await uniqueSlug(name, "giftPrize"),
        valueNote: cleanString(body.valueNote),
        isActive: readBoolean(body.isActive, true),
        isFeatured: readBoolean(body.isFeatured, false),
        sortOrder,
        // Written in the order they arrived, so the first image the admin picked
        // is the cover.
        images: { create: images.map((url, index) => ({ url, sortOrder: index })) },
      },
      include: { images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true } } },
    });

    return Response.json({ prize }, { status: 201 });
  } catch (err) {
    return prismaErrorResponse(err, "Could not create the prize.");
  }
}
