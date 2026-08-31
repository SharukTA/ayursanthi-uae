import { prisma } from "@/lib/prisma";
import {
  cleanString,
  jsonError,
  prismaErrorResponse,
  readBoolean,
  readInteger,
  requireAdmin,
} from "@/lib/admin-api";
import { getDraw, countEligibleCoupons, freezeDueDraws } from "@/lib/gift-draw";

export const runtime = "nodejs";

// GET /api/admin/gifts/draws/[id] — one draw with its prizes and winners, plus
// the catalogue to add prizes from.
export async function GET(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  // Close the entry list here if its cutoff has passed, so that reaching the
  // draw instant is by itself enough to put "Run the draw" in front of the
  // admin. Waiting for the nightly cron left a gap of up to a day in which the
  // draw was due but the console would only offer "Close entries" — a step the
  // admin then had to perform by hand before the one they actually came for.
  // No-ops on every load except the first one after a draw comes due.
  await freezeDueDraws({ drawId: id });

  const draw = await getDraw(id);
  if (!draw) return jsonError("Draw not found.", 404);

  const prizes = await prisma.giftPrize.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    // The cover only. The pool editor shows a thumbnail per line so an admin can
    // see at a glance which pooled prizes still have no artwork; the rest of a
    // prize's gallery is not something this screen renders.
    select: { id: true, name: true, valueNote: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } },
  });

  // Only meaningful while the draw is still open; once frozen, entryCount is
  // the real, recorded figure and a live count would drift away from it.
  const liveEntryCount = draw.status === "SCHEDULED" ? await countEligibleCoupons(draw) : null;

  // Whether the next step is still locked by the calendar, decided here rather
  // than in the browser. The rule is enforced server-side anyway (freezeDraw and
  // runDraw refuse an early call), and judging it against the admin's own clock
  // would let a machine set an hour fast show an enabled button that the server
  // then refuses.
  const tooEarly =
    (draw.status === "SCHEDULED" || draw.status === "FROZEN") && Date.now() < draw.drawDate.getTime();

  return Response.json({ draw, prizes, liveEntryCount, tooEarly });
}

// PATCH /api/admin/gifts/draws/[id] — set the prize pool and the fairness rule.
//
// Locked once the draw has been run. Changing the prizes after winners exist
// would rewrite what people were told they had won, and changing
// oneWinPerCustomer would describe a selection rule that was not the one
// actually applied.
export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    const draw = await prisma.giftDraw.findUnique({ where: { id } });
    if (!draw) return jsonError("Draw not found.", 404);

    if (draw.status === "DRAWN" || draw.status === "PUBLISHED") {
      return jsonError("This draw has already been run, so its prizes are locked.", 409);
    }

    const data = {};
    if (body.oneWinPerCustomer !== undefined) {
      data.oneWinPerCustomer = readBoolean(body.oneWinPerCustomer, draw.oneWinPerCustomer);
    }

    if (body.prizes !== undefined) {
      if (!Array.isArray(body.prizes)) return jsonError("Prizes must be a list.");

      // Collapse duplicates rather than tripping the unique index — the obvious
      // reading of the same prize picked twice is one line with the quantities
      // summed.
      const merged = new Map();
      for (const entry of body.prizes) {
        const prizeId = cleanString(entry?.prizeId);
        if (!prizeId) continue;
        const quantity = Math.max(1, readInteger(entry?.quantity, 1));
        merged.set(prizeId, (merged.get(prizeId) ?? 0) + quantity);
      }
      const rows = [...merged.entries()].map(([prizeId, quantity]) => ({ prizeId, quantity }));

      if (rows.length) {
        const found = await prisma.giftPrize.findMany({
          where: { id: { in: rows.map((row) => row.prizeId) } },
          select: { id: true },
        });
        if (found.length !== rows.length) {
          return jsonError("One of the prizes no longer exists. Refresh and try again.", 409);
        }
      }

      await prisma.$transaction([
        prisma.giftDrawPrize.deleteMany({ where: { drawId: id } }),
        prisma.giftDraw.update({
          where: { id },
          data: { ...data, prizes: { create: rows } },
        }),
      ]);
    } else if (Object.keys(data).length) {
      await prisma.giftDraw.update({ where: { id }, data });
    }

    return Response.json({ draw: await getDraw(id) });
  } catch (err) {
    return prismaErrorResponse(err, "Could not update the draw.");
  }
}
