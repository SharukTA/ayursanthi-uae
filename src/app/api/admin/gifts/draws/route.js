import { requireAdmin, prismaErrorResponse } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { ensureDraw, listDraws, countEligibleCoupons, freezeDueDraws } from "@/lib/gift-draw";
import { isDrawUpcoming } from "@/lib/gift-shared";
import { getGiftDrawSchedule, isGiftProgramEnabled } from "@/lib/settings";

export const runtime = "nodejs";

// GET /api/admin/gifts/draws — every draw, newest first, plus a live count of
// how many tickets the open draw would have if it closed now.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  // Same reason as on the draw detail screen: a draw whose cutoff has passed is
  // closed the moment an admin looks at the list, rather than whenever the cron
  // next sweeps. Keeps the status badge here honest and means the draw is
  // already FROZEN by the time the admin clicks into it.
  await freezeDueDraws();

  const [schedule, programEnabled, draws] = await Promise.all([
    getGiftDrawSchedule(),
    isGiftProgramEnabled(),
    listDraws(),
  ]);

  // The open draw's entryCount is still 0 (it is only written at freeze time),
  // so the list would otherwise show "0 entries" for the one draw an admin
  // actually wants to watch filling up.
  const open = draws.find((draw) => draw.status === "SCHEDULED");
  const liveEntryCount = open ? await countEligibleCoupons(open) : null;

  return Response.json({
    draws,
    liveEntryCount,
    openDrawId: open?.id ?? null,
    // Echoed so the Gifts screen can show — and edit — the schedule without a
    // second request to the settings API. `drawPassed` is what turns the
    // calendar into a prompt: once the announced date is behind us the store is
    // advertising nothing, and the admin needs to pick the next one.
    drawDate: schedule.date,
    drawTime: schedule.time,
    drawPassed: !isDrawUpcoming(schedule.date, schedule.time),
    programEnabled,
  });
}

// POST /api/admin/gifts/draws — open the draw for the scheduled date.
//
// Normally the cron does this; an admin opens it by hand to load prizes onto it
// in advance, or after a run the schedule missed. It takes no date: the schedule
// is the `gift_draw_date` setting and there is exactly one upcoming draw, so
// letting this endpoint name a different date would only be a way to end up with
// two draws claiming to be next.
export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { date } = await getGiftDrawSchedule();
    const existed = await prisma.giftDraw.findUnique({ where: { cycleKey: date } });
    const draw = await ensureDraw(date);

    return Response.json({ draw, created: !existed }, { status: existed ? 200 : 201 });
  } catch (err) {
    return prismaErrorResponse(err, "Could not open the draw.");
  }
}
