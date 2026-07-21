import { prisma } from "@/lib/prisma";
import {
  cleanString,
  HOME_SECTION_TYPES,
  jsonError,
  prismaErrorResponse,
  readBoolean,
  readInteger,
  requireAdmin,
  SECTION_PLACEMENTS,
} from "@/lib/admin-api";

export const runtime = "nodejs";

// Item shape returned with each section. Items are ordered by position so the
// admin list and the public homepage agree on order.
const itemInclude = {
  orderBy: { position: "asc" },
  include: {
    product: {
      select: { id: true, name: true, slug: true, price: true, mrp: true },
    },
  },
};

// GET /api/admin/home-sections — every section (active and inactive) with its
// items, ordered for the Content Builder. An optional `?placement=` query scopes
// the list to one page-type tab (HOME, PRODUCT, CATEGORY, CHECKOUT); omitting it
// returns all placements.
export async function GET(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const placement = cleanString(new URL(request.url).searchParams.get("placement"));
  const where =
    placement && SECTION_PLACEMENTS.includes(placement) ? { placement } : {};

  const sections = await prisma.homeSection.findMany({
    where,
    orderBy: { position: "asc" },
    include: { items: itemInclude },
  });

  return Response.json({ sections });
}

// POST /api/admin/home-sections — create a new (empty) section. New sections are
// appended to the end by default so they don't disturb existing ordering.
export async function POST(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const type = cleanString(body.type);

    if (!type || !HOME_SECTION_TYPES.includes(type)) {
      return jsonError("A valid section type is required.");
    }

    // Placement defaults to HOME so existing callers keep working; any provided
    // value must be a known placement.
    const placement = cleanString(body.placement) || "HOME";
    if (!SECTION_PLACEMENTS.includes(placement)) {
      return jsonError("A valid section placement is required.");
    }

    // Default position = end of the list FOR THIS PLACEMENT (each page-type has
    // its own ordering) unless the admin specified one.
    let position = body.position;
    if (position === undefined || position === null || position === "") {
      const last = await prisma.homeSection.findFirst({
        where: { placement },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      position = (last?.position ?? -1) + 1;
    } else {
      position = readInteger(position, 0);
    }

    const section = await prisma.homeSection.create({
      data: {
        type,
        placement,
        title: cleanString(body.title),
        eyebrow: cleanString(body.eyebrow),
        subtitle: cleanString(body.subtitle),
        position,
        isActive: readBoolean(body.isActive, true),
      },
      include: { items: itemInclude },
    });

    return Response.json({ section }, { status: 201 });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to create section.");
  }
}
