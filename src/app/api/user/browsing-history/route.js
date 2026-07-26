import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { SECTION_PRODUCT_SELECT, toProductItem } from "@/lib/page-sections";
import { HISTORY_PAGE_LIMIT, isValidProductId } from "@/lib/browsing-history";

export const runtime = "nodejs";

// Amazon's "Browsing History" page, server side: view what we hold, remove
// individual items or all of them, and turn recording off.
//
// Everything here is scoped to `session.userId` — a product id in the URL only
// ever deletes the caller's own row, never anyone else's.

async function requireUser() {
  const session = await getSession();
  if (!session) {
    return { error: Response.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}

// GET /api/user/browsing-history — the full list plus the recording switch.
//
// Unlike the homepage strip this returns history even while recording is turned
// OFF: the shopper must still be able to see and delete what we already hold.
export async function GET() {
  const { session, error } = await requireUser();
  if (error) return error;

  const [user, rows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { browsingHistoryEnabled: true },
    }),
    prisma.productView.findMany({
      where: { userId: session.userId, product: { isActive: true } },
      orderBy: { viewedAt: "desc" },
      take: HISTORY_PAGE_LIMIT,
      select: { viewedAt: true, product: { select: SECTION_PRODUCT_SELECT } },
    }),
  ]);

  const items = rows.map((row) => ({
    ...toProductItem(row.product),
    viewedAt: row.viewedAt.toISOString(),
  }));

  return Response.json({
    items,
    enabled: Boolean(user?.browsingHistoryEnabled),
  });
}

// PATCH /api/user/browsing-history { enabled } — the on/off switch.
//
// Turning it off stops recording and hides the history everywhere, but keeps the
// rows: erasing them is a separate, deliberate action (DELETE below), so a
// shopper who flicks the switch by accident doesn't lose anything.
export async function PATCH(request) {
  const { session, error } = await requireUser();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  if (typeof body?.enabled !== "boolean") {
    return Response.json({ message: "`enabled` must be true or false." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { browsingHistoryEnabled: body.enabled },
  });

  return Response.json({
    enabled: body.enabled,
    message: body.enabled
      ? "Browsing history is on."
      : "Browsing history is off. We'll stop recording the products you view.",
  });
}

// DELETE /api/user/browsing-history[?productId=x]
//   with productId — remove that one product
//   without        — remove everything
export async function DELETE(request) {
  const { session, error } = await requireUser();
  if (error) return error;

  const productId = new URL(request.url).searchParams.get("productId");

  if (productId) {
    if (!isValidProductId(productId)) {
      return Response.json({ message: "Invalid product." }, { status: 400 });
    }
    // deleteMany, not delete: scoping by userId in the filter means a missing
    // row is a no-op rather than a P2025, and one shopper can never target
    // another's history.
    const { count } = await prisma.productView.deleteMany({
      where: { userId: session.userId, productId },
    });
    return Response.json({ removed: count, message: "Removed from your browsing history." });
  }

  const { count } = await prisma.productView.deleteMany({
    where: { userId: session.userId },
  });
  return Response.json({ removed: count, message: "Your browsing history has been cleared." });
}
