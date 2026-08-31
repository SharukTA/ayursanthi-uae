import { freezeDueDraws, ensureDraw } from "@/lib/gift-draw";
import { formatDrawDateTime, isDrawUpcoming } from "@/lib/gift-shared";
import { getGiftDrawSchedule, isGiftProgramEnabled } from "@/lib/settings";

export const runtime = "nodejs";
// Never cached: this route has side effects and must run on every invocation.
export const dynamic = "force-dynamic";

/**
 * Scheduled close of the gift draw. Wired to 00:00 Gulf time EVERY day in
 * vercel.json, not to the draw date.
 *
 * It is the backstop, not the only closer. The admin console runs the same
 * sweep on every read, so in practice a due draw is usually already frozen by
 * the time this fires — an admin looked at it first. What this guarantees is
 * that the cutoff lands even if nobody logs in for a week.
 *
 * A daily run is what makes the draw date an admin setting rather than a deploy.
 * A cron pinned to one date can only ever close the draw held on it, so the
 * moment somebody moved the date the schedule would be closing nothing — or
 * worse, closing the wrong draw. Instead the job asks the database what is
 * actually due: any draw still SCHEDULED whose cycle has ended. On every other
 * day of the year it finds nothing and stops.
 *
 * That also makes it self-healing. A missed run, a deploy during the window, a
 * day of downtime — the next run finds the overdue draw still sitting there and
 * closes it, where a once-a-month schedule would have skipped the month.
 *
 * It freezes the entry list and stops there. Picking the winners is left to an
 * admin pressing the button in /admin/gifts/draws, because the prizes on offer
 * include cars and property and an unattended job should not be the thing that
 * awards them. What the schedule is really for is the cutoff: entries have to
 * stop accruing at a fixed, published instant, and that cannot depend on when
 * somebody happens to log in.
 *
 * Safe to run repeatedly. freezeDraw returns `already_frozen` rather than
 * re-snapshotting, so a retry, a manual trigger, or an overlapping schedule
 * cannot disturb a list that has already closed.
 */
export async function GET(request) {
  // Vercel signs cron invocations with CRON_SECRET. Without this the endpoint
  // is a public button that closes the draw early — anyone could freeze the
  // entry list before a cycle was actually over.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set; refusing to run the gift draw cron.");
    return Response.json({ message: "Not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (!(await isGiftProgramEnabled())) {
    return Response.json({ status: "programme_off" });
  }

  try {
    const now = new Date();

    // Everything whose cutoff has passed but which nobody has closed. Shared
    // with the admin console, which runs the same sweep on every read so a due
    // draw is closed the moment somebody looks at it rather than at the next
    // midnight. Whichever gets there first, the other finds nothing left to do.
    const frozen = await freezeDueDraws({ now });

    // The draw now accruing, opened so the customer dashboard has something to
    // point at from day one. ensureDraw also re-dates it if the scheduled date
    // was changed since it was opened, which is what keeps "your coupons are in
    // the 31 December draw" honest after an admin moves the date.
    //
    // Skipped once the announced date has passed with no new one chosen. Opening
    // a draw on a date already behind us would create a row the very next run
    // freezes — closing an empty draw nobody advertised — so the job leaves the
    // schedule alone and the Gifts console shows the admin that a date is due.
    const schedule = await getGiftDrawSchedule();
    const accruing = isDrawUpcoming(schedule.date, schedule.time, now)
      ? await ensureDraw(schedule.date, schedule.time)
      : null;

    return Response.json({
      status: frozen.length > 0 ? "frozen" : "nothing_due",
      frozen,
      nextDrawDate: accruing ? formatDrawDateTime(accruing.drawDate) : null,
      awaitingSchedule: !accruing,
    });
  } catch (error) {
    console.error("Gift draw cron failed:", error);
    return Response.json({ message: "Could not close the draw." }, { status: 500 });
  }
}
