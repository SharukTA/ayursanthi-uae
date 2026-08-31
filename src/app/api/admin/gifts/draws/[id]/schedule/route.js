import { prisma } from "@/lib/prisma";
import { jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";
import { rescheduleDraw } from "@/lib/gift-draw";
import {
  drawInstant,
  formatDrawDateTime,
  normalizeDrawDate,
  normalizeDrawTime,
} from "@/lib/gift-shared";

export const runtime = "nodejs";

// PATCH /api/admin/gifts/draws/[id]/schedule — move one draw to a new date/time.
//
// Its own route rather than another branch of the draw's PATCH, because the two
// have genuinely different rules: the prize pool stays editable right up until
// the winners are picked, while the DATE is frozen the moment the entry list is
// — a frozen draw's window is the definition of a cutoff that has already been
// applied to real customers.
//
// Writes the settings as well as the row. `gift_draw_date` / `gift_draw_time`
// are the schedule of record, so a draw moved without them would be dragged back
// to the old date by the next ensureDraw the nightly cron runs — the change
// would appear to work, then silently undo itself overnight.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));

    // Passing null as the fallback so a bad value is rejected rather than
    // quietly becoming the default date — an admin who mistypes must be told,
    // not silently moved somewhere they did not choose.
    const date = normalizeDrawDate(body.drawDate, null);
    const time = normalizeDrawTime(body.drawTime, null);

    if (!date) return jsonError('Pick a real date, like 2026-12-31.');
    if (!time) return jsonError("Pick a real time of day, like 13:00.");

    // The draw instant is the entry cutoff, so a moment already gone would mean
    // a draw the nightly job closes on its very next run — a giveaway shut
    // before anybody was told it had moved.
    const instant = drawInstant(date, time);
    if (instant.getTime() <= Date.now()) {
      return jsonError("That date and time have already passed. Pick a moment in the future.");
    }

    const result = await rescheduleDraw(id, date, time);

    if (result.status === "not_found") return jsonError("Draw not found.", 404);
    if (result.status === "locked") {
      return jsonError(
        "This draw's entry list has already closed, so its date is fixed. " +
          "Customers were told when it would be held, and moving it now would change who was in it.",
        409
      );
    }
    if (result.status === "clash") {
      return jsonError(
        `Another draw (${result.draw.cycleKey}) is already scheduled for that date.`,
        409
      );
    }

    // Only after the move succeeded: if the row could not be updated, leaving
    // the settings pointing at the new date would open a SECOND draw there on
    // the next cron run.
    await prisma.$transaction([
      prisma.siteSetting.upsert({
        where: { key: "gift_draw_date" },
        update: { value: date },
        create: { key: "gift_draw_date", value: date },
      }),
      prisma.siteSetting.upsert({
        where: { key: "gift_draw_time" },
        update: { value: time },
        create: { key: "gift_draw_time", value: time },
      }),
    ]);

    return Response.json({
      draw: result.draw,
      message: `Draw moved to ${formatDrawDateTime(result.draw.drawDate)}.`,
    });
  } catch (err) {
    return prismaErrorResponse(err, "Could not move the draw.");
  }
}
