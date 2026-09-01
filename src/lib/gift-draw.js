// Running a gift draw: creating it, freezing its entry list, picking winners,
// and publishing them.
//
// The lifecycle is strictly forward — SCHEDULED, FROZEN, DRAWN, PUBLISHED — and
// every step below refuses to run out of order. That rigidity is the point: a
// draw that can be re-run, or run against a list that is still moving, is a
// draw nobody can be asked to trust.
//
// Server-only. The calendar arithmetic is in lib/gift-shared.js, which the
// browser shares.

import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { canHaveAffiliateId } from "@/lib/referral";
import { formatPostalLines } from "@/lib/address";
import { drawInstant, entryCutoffFor, normalizeDrawDate } from "@/lib/gift-shared";
import { getCancelWindowHours, getGiftDrawSchedule, getGiftProgramStart } from "@/lib/settings";
import { sendGiftDrawWinnerEmails } from "@/lib/email-gifts";

// Entries are written in batches so freezing a large cycle is a handful of
// round trips rather than one statement per ticket.
const ENTRY_INSERT_BATCH = 500;

/**
 * Where the qualifying window for a draw held at `instant` begins.
 *
 * The previous draw's ENTRY CUTOFF — not the instant it was held — or the
 * programme start date when there has never been one.
 *
 * The distinction is what keeps the calendar tiled. Entries close one
 * cancellation window before a draw (see entryCutoffFor), so if the next window
 * still began at the previous draw's instant, the hours between that draw's
 * cutoff and the draw itself would belong to no draw at all and every purchase
 * made in them would be orphaned for ever. Moving BOTH edges by the same amount
 * means the windows still abut exactly: no purchase falls through a gap, none is
 * counted by two draws, and a purchase made too close to one draw simply counts
 * towards the next.
 *
 * It also means the spacing between draws can be anything. Chaining off the
 * previous cutoff makes each window exactly as wide as the gap between the two
 * draws, so a draw scheduled sooner after the last one than the cancellation
 * window is long still has a real entry list rather than an empty one.
 *
 * Still a database question rather than arithmetic, because draws are scheduled
 * one at a time by date — there is no cadence to subtract a month from.
 *
 * @param {Date} instant     the instant the draw is held
 * @param {string} [exceptId] the draw being (re)dated, so it never bounds itself
 */
async function cycleStartFor(instant, exceptId) {
  const previous = await prisma.giftDraw.findFirst({
    where: {
      cycleEnd: { lte: instant },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    orderBy: { cycleEnd: "desc" },
    select: { entryCutoff: true },
  });

  return previous?.entryCutoff ?? (await getGiftProgramStart());
}

/**
 * The window a draw held at `cycleEnd` accepts purchases in, as the two stored
 * columns. One place so ensureDraw, refreshWindow and rescheduleDraw cannot
 * derive it three slightly different ways.
 *
 * The cutoff is read from the LIVE cancellation window every time this runs,
 * which is exactly what should happen while a draw is still SCHEDULED: lengthen
 * `order_cancel_window_hours` and entries close correspondingly earlier, so the
 * two settings can never drift apart and reopen the hole this closes. Once the
 * draw is frozen the stored value is frozen with it.
 */
async function windowFor(cycleEnd, exceptId) {
  const [cycleStart, windowHours] = await Promise.all([
    cycleStartFor(cycleEnd, exceptId),
    getCancelWindowHours(),
  ]);

  return { cycleStart, entryCutoff: entryCutoffFor(cycleEnd, windowHours) };
}

/**
 * Find or create the draw held on a given date.
 *
 * Safe to call concurrently: the unique index on cycleKey — which IS the date —
 * means the loser of a race gets P2002 and simply reads back the row the winner
 * created, so the scheduled freeze and an admin clicking "open" cannot produce
 * two draws for one date.
 *
 * Also the one place a change to the `gift_draw_date` setting takes effect.
 * There is only ever ONE upcoming draw, so moving the date re-dates the draw
 * already open rather than opening a second one beside it and leaving the first
 * to be frozen by the cron on a date nobody announced. A draw still SCHEDULED
 * has not promised anybody anything yet; a draw that has been frozen is left
 * exactly as it is, because its stored window is the definition of the entry
 * list already snapshotted from it. Moving the date must never rewrite a cutoff
 * that has already been applied.
 *
 * @param {string} [drawDate]  "YYYY-MM-DD"; defaults to the scheduled date
 * @param {string} [drawTime]  "HH:MM" in store time; defaults to the scheduled time
 */
export async function ensureDraw(drawDate, drawTime) {
  // The time is read alongside the date even when a date was passed in, because
  // the two are halves of one instant: opening "the draw on the 31st" without
  // the scheduled hour would set a cutoff of midnight and quietly exclude
  // everybody who shopped on the day the poster told them to.
  const schedule = await getGiftDrawSchedule();
  const iso = normalizeDrawDate(drawDate ?? schedule.date, null);
  const cycleEnd = drawInstant(iso, drawTime ?? schedule.time);
  if (!cycleEnd) throw new Error(`Invalid gift draw date: ${drawDate}`);

  const existing = await prisma.giftDraw.findUnique({ where: { cycleKey: iso } });
  if (existing) {
    if (existing.status !== "SCHEDULED") return existing;
    return refreshWindow(existing, iso, cycleEnd);
  }

  // The upcoming draw under its previous date. Re-dated in place so the coupons
  // an admin has been watching accrue, and any prizes already loaded onto it,
  // move with the date instead of being stranded on an orphan row.
  const pending = await prisma.giftDraw.findFirst({
    where: { status: "SCHEDULED" },
    orderBy: { drawDate: "asc" },
  });
  if (pending) return refreshWindow(pending, iso, cycleEnd);

  try {
    return await prisma.giftDraw.create({
      data: {
        cycleKey: iso,
        drawDate: cycleEnd,
        cycleEnd,
        ...(await windowFor(cycleEnd)),
      },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return prisma.giftDraw.findUnique({ where: { cycleKey: iso } });
    }
    throw error;
  }
}

/**
 * Move a still-SCHEDULED draw onto `iso`, or leave it alone if it is already
 * there. Returns the current row either way.
 *
 * The write is conditional on the status we read, like every other transition
 * here: if the draw was frozen while we were deciding, the freeze wins and its
 * window stands.
 */
async function refreshWindow(draw, iso, cycleEnd) {
  const { cycleStart, entryCutoff } = await windowFor(cycleEnd, draw.id);

  // entryCutoff is compared like the rest of the window, not derived from the
  // others, because it moves on its own: an admin editing the cancellation
  // window shifts when entries close without touching the draw date at all, and
  // a check that only looked at the dates would leave the draw advertising a
  // cutoff it would no longer be frozen against.
  const stale =
    draw.cycleKey !== iso ||
    draw.drawDate.getTime() !== cycleEnd.getTime() ||
    draw.cycleStart.getTime() !== cycleStart.getTime() ||
    draw.entryCutoff.getTime() !== entryCutoff.getTime() ||
    draw.cycleEnd.getTime() !== cycleEnd.getTime();
  if (!stale) return draw;

  await prisma.giftDraw.updateMany({
    where: { id: draw.id, status: "SCHEDULED" },
    data: { cycleKey: iso, drawDate: cycleEnd, cycleStart, entryCutoff, cycleEnd },
  });

  return prisma.giftDraw.findUnique({ where: { id: draw.id } });
}

/**
 * Move one specific draw to a new date and time.
 *
 * Distinct from ensureDraw, which finds-or-creates "the upcoming draw" and would
 * happily re-date a different row if more than one were somehow open. This one
 * names the draw it is moving, so the button beside a row in the admin list can
 * only ever affect that row.
 *
 * Refused unless the draw is still SCHEDULED. A frozen draw's window is the
 * definition of an entry list already snapshotted from it, and a drawn one has
 * winners chosen under it — moving either would retroactively redefine which
 * coupons were eligible for a result that has already been decided. That is the
 * one thing this whole module is built not to allow.
 *
 * Moving a SCHEDULED draw moves its entry cutoff with it, since the cutoff is
 * measured back from the draw instant. Bringing a draw FORWARD therefore closes
 * entries earlier, and coupons whose owners were shown an "In the draw" badge
 * can fall back to counting towards the following draw instead. Nothing is lost
 * — the next draw's window starts at this one's cutoff — but it is a visible
 * change to a customer, which is worth saying out loud on the button that does
 * it.
 *
 * The caller is responsible for writing the `gift_draw_date` / `gift_draw_time`
 * settings alongside this. They are the schedule of record, and a draw moved
 * without them would be dragged straight back by the next ensureDraw the cron
 * runs.
 *
 * @returns {Promise<{status: string, draw?: object}>}
 *   "rescheduled" | "not_found" | "locked" | "clash"
 */
export async function rescheduleDraw(drawId, isoDate, time) {
  const cycleEnd = drawInstant(isoDate, time);
  if (!cycleEnd) throw new Error(`Invalid gift draw date: ${isoDate}`);

  const draw = await prisma.giftDraw.findUnique({ where: { id: drawId } });
  if (!draw) return { status: "not_found" };
  if (draw.status !== "SCHEDULED") return { status: "locked", draw };

  // The date IS the key, so moving onto a date another draw already occupies
  // would collide on the unique index. Caught here so the admin gets told which
  // rule they hit rather than a constraint error they can do nothing with.
  const clash = await prisma.giftDraw.findUnique({ where: { cycleKey: isoDate } });
  if (clash && clash.id !== draw.id) return { status: "clash", draw: clash };

  const { cycleStart, entryCutoff } = await windowFor(cycleEnd, draw.id);

  // Conditional on the status we read, like every other transition here: if the
  // draw was frozen while the admin had the form open, the freeze wins and its
  // window stands.
  const moved = await prisma.giftDraw.updateMany({
    where: { id: draw.id, status: "SCHEDULED" },
    data: { cycleKey: isoDate, drawDate: cycleEnd, cycleStart, entryCutoff, cycleEnd },
  });

  const updated = await prisma.giftDraw.findUnique({ where: { id: draw.id } });
  if (moved.count === 0) return { status: "locked", draw: updated };

  return { status: "rescheduled", draw: updated };
}

/**
 * The next draw and the window a coupon must fall in to enter it — READ ONLY.
 *
 * ensureDraw writes, which is wrong for the customer-facing endpoints: a
 * signed-in visitor loading their coupons must not be the thing that opens next
 * month's draw, and on a page that revalidates every few minutes it would be a
 * write on every cache miss. So this reads the SCHEDULED draw when there is one
 * and otherwise computes the same window the cron will persist, which means the
 * dates a customer is shown are the dates they will actually be judged against
 * whether or not anybody has opened the draw yet.
 *
 * @returns {{cycleKey: string, drawDate: Date, cycleStart: Date, entryCutoff: Date, cycleEnd: Date}|null}
 *   null only when no valid date is configured at all. `entryCutoff` is the one
 *   the customer's coupons are judged against; `cycleEnd`/`drawDate` is when the
 *   draw is held and is what the store advertises.
 */
export async function getUpcomingDraw() {
  const [pending, schedule] = await Promise.all([
    prisma.giftDraw.findFirst({ where: { status: "SCHEDULED" }, orderBy: { drawDate: "asc" } }),
    getGiftDrawSchedule(),
  ]);

  const iso = schedule.date;
  const cycleEnd = drawInstant(iso, schedule.time);

  // An open draw that already sits on the configured date is the answer, and
  // its stored window is authoritative — that is the row the freeze will use.
  if (pending && (!cycleEnd || pending.cycleEnd.getTime() === cycleEnd.getTime())) {
    return {
      cycleKey: pending.cycleKey,
      drawDate: pending.drawDate,
      cycleStart: pending.cycleStart,
      entryCutoff: pending.entryCutoff,
      cycleEnd: pending.cycleEnd,
    };
  }

  if (!cycleEnd) return null;

  return {
    cycleKey: iso,
    drawDate: cycleEnd,
    cycleEnd,
    ...(await windowFor(cycleEnd, pending?.id)),
  };
}

/**
 * Which coupons are eligible for a draw's cycle.
 *
 * Four conditions, each of which has cost somebody a dispute somewhere:
 *   - lastQualifiedAt inside the half-open window [cycleStart, entryCutoff),
 *     i.e. the owner bought something during this cycle AND did so early enough
 *     that the purchase can no longer be cancelled by the time the draw runs;
 *   - the coupon is not voided;
 *   - the order that earned it was not cancelled — a refunded purchase must not
 *     leave a live ticket behind, and the void above only covers coupons the
 *     cancel flow reached;
 *   - the owner is still a customer, so an account promoted to admin drops out
 *     of the programme immediately, exactly as it does for affiliate IDs.
 *
 * The cutoff is the load-bearing one, and it is deliberately a bound on
 * lastQualifiedAt rather than on the source order's date. A qualifying purchase
 * wakes EVERY coupon its owner holds, not just the one it mints, and all of them
 * are stamped with that purchase's instant — so a customer with a drawer full of
 * dormant coupons could otherwise put the lot into a draw with one last-minute
 * order and then cancel it. Those woken coupons are not voided by the cancel
 * flow (their own source orders are untouched), so nothing further down would
 * ever catch them. Bounding the stamp covers the minted coupon and the woken
 * ones in a single condition, because they all carry the same one.
 */
function eligibleCouponWhere({ cycleStart, entryCutoff }) {
  return {
    voidedAt: null,
    lastQualifiedAt: { gte: cycleStart, lt: entryCutoff },
    sourceOrder: { status: { not: "CANCELLED" } },
    user: { role: "CUSTOMER" },
  };
}

/**
 * How many tickets a draw would have if it were frozen right now.
 *
 * Judged against the draw's STORED window, so the number an admin is shown is
 * the number the freeze would actually snapshot — including the cutoff, which
 * means a coupon earned in the last hours before the draw is correctly absent
 * from this count rather than appearing and then vanishing at freeze time.
 */
export async function countEligibleCoupons(draw) {
  return prisma.giftCoupon.count({ where: eligibleCouponWhere(draw) });
}

/**
 * Take the entry snapshot and close the draw to new entries.
 *
 * This is the step that makes the result defensible. Eligibility is derived
 * from data that never stops moving — every qualifying purchase rewrites
 * lastQualifiedAt on a customer's whole collection — so without a frozen copy
 * there is no way, a week later, to say who was actually in the drum.
 *
 * Idempotent: a draw that is already frozen is returned untouched rather than
 * re-snapshotted, so the scheduled job can safely run twice.
 *
 * Refused before the draw date. The date is a published promise — customers are
 * told their coupons are in the draw held on a named day — so snapshotting early
 * would quietly exclude anyone whose coupon was still moving. The entry cutoff
 * that decides WHO is in the list is a separate, earlier instant and is applied
 * inside the query below. The gate is here rather than in the admin API because
 * the rule belongs to the draw, not to one screen: the cron reaches this
 * function too, and only ever at or after the instant, so the schedule is
 * unaffected.
 *
 * @param {string} cycleKey  an existing draw's key, or a "YYYY-MM-DD" to open
 * @param {object} [options]
 * @param {Date} [options.now]  the instant to judge earliness against
 */
export async function freezeDraw(cycleKey, { now = new Date() } = {}) {
  // Looked up by key BEFORE falling back to ensureDraw. A draw already on record
  // is the one to freeze whatever its key looks like — including a draw created
  // under the old month-based scheme, whose "2026-09" is not a date ensureDraw
  // could parse. Only a key with no row behind it is treated as a date and
  // opened.
  const draw = (await prisma.giftDraw.findUnique({ where: { cycleKey } })) ??
    (await ensureDraw(cycleKey));

  if (draw.status !== "SCHEDULED") {
    return { status: "already_frozen", draw };
  }

  // cycleEnd IS the draw instant. Entries closed one cancellation window before
  // it, but the SNAPSHOT is still taken at the draw itself — closing the list
  // early and taking the picture early are different things, and taking it early
  // would miss a coupon voided in between.
  if (now.getTime() < draw.cycleEnd.getTime()) {
    return { status: "too_early", draw };
  }

  // The cutoff is recomputed from the live cancellation window and written down
  // in the same statement that freezes the draw, rather than trusted from the
  // row. The stored value is kept fresh by ensureDraw, but only while something
  // calls it — a draw created before the cancellation window was last edited and
  // then frozen by the cron would otherwise be snapshotted against a cutoff that
  // no longer matches the policy it exists to enforce. After this write the
  // stored value is exactly what the entry list was built from, for ever, which
  // is the whole reason the column exists.
  const entryCutoff = entryCutoffFor(draw.cycleEnd, await getCancelWindowHours());

  // An empty window means nobody can possibly be in this draw, and a draw that
  // freezes zero entries for a structural reason rather than a commercial one is
  // exactly the kind of thing that gets noticed a week later. It should not be
  // reachable: cycleStart is the PREVIOUS draw's cutoff, so a window is normally
  // as wide as the gap between the two draws however close together they are.
  // The one way in is a draw whose predecessor pre-dates the cutoff column and
  // was backfilled to its own instant — the seam this was introduced across —
  // and only then if the two draws are less than a cancellation window apart.
  // Said out loud rather than left as a zero for somebody to explain.
  if (entryCutoff.getTime() <= draw.cycleStart.getTime()) {
    console.warn(
      `Draw ${draw.cycleKey} has an empty qualifying window: entries close ` +
        `${entryCutoff.toISOString()}, which is at or before the window opens ` +
        `${draw.cycleStart.toISOString()}. Nothing can enter it. This draw is likely ` +
        `scheduled less than one cancellation window after the one before it.`
    );
  }

  const coupons = await prisma.giftCoupon.findMany({
    where: eligibleCouponWhere({ cycleStart: draw.cycleStart, entryCutoff }),
    // Stable, total ordering. `id` breaks ties on identical timestamps, which
    // are common: one order mints several coupons in the same millisecond, and
    // a reactivation stamps a whole collection with one instant. Without the
    // tiebreak, positions would not be reproducible.
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, code: true, userId: true },
  });

  const entries = coupons.map((coupon, position) => ({
    drawId: draw.id,
    couponId: coupon.id,
    couponCode: coupon.code,
    userId: coupon.userId,
    position,
  }));

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < entries.length; i += ENTRY_INSERT_BATCH) {
      await tx.giftDrawEntry.createMany({
        data: entries.slice(i, i + ENTRY_INSERT_BATCH),
        skipDuplicates: true,
      });
    }

    // Conditional on the status we read: if another caller froze this draw
    // while we were building the snapshot, theirs stands and ours is a no-op.
    await tx.giftDraw.updateMany({
      where: { id: draw.id, status: "SCHEDULED" },
      data: {
        status: "FROZEN",
        frozenAt: new Date(),
        entryCount: entries.length,
        entryCutoff,
      },
    });
  });

  const frozen = await prisma.giftDraw.findUnique({ where: { id: draw.id } });
  return { status: "frozen", draw: frozen, entryCount: entries.length };
}

/**
 * Freeze every draw whose cutoff has passed but which nobody has closed yet.
 *
 * The scheduled job in /api/cron/gift-draw is the guarantee that this happens
 * even if nobody logs in; this is what makes it happen *on time*. A cron fires
 * on a clock, not on a row, so between the draw instant and the next sweep
 * there was a window — up to a full day — in which a draw was due, the entry
 * list was morally closed, and yet the admin console still offered "Close
 * entries" instead of "Run the draw". Calling this wherever an admin reads a
 * draw collapses that window: the page is the trigger, so the button is correct
 * the moment somebody looks at it.
 *
 * Cheap enough to sit in a GET. It is one indexed lookup that finds nothing on
 * every day except the one after a draw, and freezeDraw itself returns
 * `already_frozen` without re-snapshotting, so a refresh, two admins on the
 * page at once, or an overlap with the cron cannot disturb a closed list.
 *
 * It cannot close anything early: freezeDraw re-checks `now >= cycleEnd` itself
 * and the query only selects rows already past it. The cutoff applied is always
 * the draw's own stored window, never the moment this ran, so a list frozen
 * here contains exactly the coupons it would have contained at midnight.
 *
 * Normally nought or one draw. More than one only after nobody has looked and
 * the cron has been unable to run across two draws — which is the case a fixed
 * schedule handled worst, and the reason this asks the database what is due
 * rather than assuming the most recent one.
 *
 * @param {object} [options]
 * @param {string} [options.drawId]  limit to one draw; omit to sweep them all
 * @param {Date} [options.now]
 * @returns {Promise<Array<{cycleKey: string, status: string, entryCount: number}>>}
 */
export async function freezeDueDraws({ drawId, now = new Date() } = {}) {
  const due = await prisma.giftDraw.findMany({
    where: {
      status: "SCHEDULED",
      cycleEnd: { lte: now },
      ...(drawId ? { id: drawId } : {}),
    },
    orderBy: { cycleEnd: "asc" },
    select: { cycleKey: true },
  });

  const frozen = [];
  for (const draw of due) {
    const result = await freezeDraw(draw.cycleKey, { now });
    frozen.push({
      cycleKey: draw.cycleKey,
      status: result.status,
      entryCount: result.entryCount ?? result.draw?.entryCount ?? 0,
    });
  }
  return frozen;
}

/**
 * Pick winners uniformly at random, without replacement.
 *
 * Uses node:crypto's randomInt, not Math.random. Math.random is a PRNG with no
 * cryptographic guarantees and, in V8, a 128-bit internal state that can be
 * recovered from a modest run of outputs — so a draw awarding cars must not be
 * decided by it. randomInt is also free of the modulo bias you get from
 * `floor(random() * n)`.
 *
 * When `oneWinPerCustomer` is set, a customer who has already been drawn has
 * their remaining tickets skipped rather than removed up front. That ordering
 * matters: holding more coupons still improves the chance of being drawn at
 * all, which is the point of the programme — it only stops one person taking
 * several prizes from a single draw.
 *
 * @param {Array<{couponId: string, userId: string, couponCode: string}>} entries
 * @param {string[]} prizeSlots  one prizeId per prize unit on offer
 * @param {boolean} oneWinPerCustomer
 */
export function selectWinners(entries, prizeSlots, oneWinPerCustomer = true) {
  // Copied because the selection destroys the array as it goes.
  const pool = [...entries];
  let remaining = pool.length;

  const drawnUserIds = new Set();
  const winners = [];

  while (winners.length < prizeSlots.length && remaining > 0) {
    const index = randomInt(0, remaining);
    const entry = pool[index];

    // Swap-remove: move the last live element into the hole. Keeps the draw
    // O(1) per ticket instead of O(n) from splicing, and every remaining
    // position stays equally likely.
    pool[index] = pool[remaining - 1];
    remaining -= 1;

    if (oneWinPerCustomer && drawnUserIds.has(entry.userId)) continue;

    drawnUserIds.add(entry.userId);
    winners.push({ entry, prizeId: prizeSlots[winners.length] });
  }

  return winners;
}

/**
 * Run a frozen draw: pick the winners and record who is owed what.
 *
 * Refuses anything but a FROZEN draw, which is what stops a result being
 * quietly re-rolled — once winners exist the draw is DRAWN, and this returns
 * `already_drawn` for ever after.
 *
 * Refused before the draw date, for the same reason freezeDraw is: the store
 * publishes the day a draw is held on, and picking winners days early makes that
 * date a fiction. In practice a draw cannot reach FROZEN before its date anyway
 * — the freeze gate sees to that — so this is a second lock on the same door,
 * kept because "no winners before the draw date" is a rule worth enforcing where
 * winners are actually created rather than inferring it from the state machine.
 *
 * @param {object} args
 * @param {string} args.drawId
 * @param {string} [args.adminUserId]  recorded as who ran it
 * @param {Date} [args.now]  the instant to judge earliness against
 */
export async function runDraw({ drawId, adminUserId, now = new Date() }) {
  const draw = await prisma.giftDraw.findUnique({
    where: { id: drawId },
    include: { prizes: true },
  });

  if (!draw) return { status: "not_found" };
  if (draw.status === "SCHEDULED") return { status: "not_frozen", draw };
  if (draw.status !== "FROZEN") return { status: "already_drawn", draw };
  if (now.getTime() < draw.drawDate.getTime()) return { status: "too_early", draw };

  if (draw.prizes.length === 0) {
    return { status: "no_prizes", draw };
  }

  // One slot per unit on offer: three smart watches means three chances to be
  // drawn, each awarding a smart watch.
  const prizeSlots = draw.prizes.flatMap((drawPrize) =>
    Array.from({ length: Math.max(0, drawPrize.quantity) }, () => drawPrize.prizeId)
  );

  if (prizeSlots.length === 0) return { status: "no_prizes", draw };

  // Voided coupons are dropped even though the list is frozen.
  //
  // Freezing settles WHO was in the draw; it does not oblige the store to award
  // a prize to a ticket that has since been refunded. An order cancelled in the
  // hours between the entry list closing and an admin pressing "run" would
  // otherwise still be able to win — the customer has their money back and a
  // villa. The frozen GiftDrawEntry rows are deliberately left in place, so the
  // record still shows the ticket was in the drum and why it was passed over.
  const entries = await prisma.giftDrawEntry.findMany({
    where: { drawId: draw.id, coupon: { voidedAt: null } },
    select: { couponId: true, couponCode: true, userId: true },
  });

  const excluded = draw.entryCount - entries.length;
  if (excluded > 0) {
    console.warn(
      `Draw ${draw.cycleKey}: ${excluded} frozen entr${excluded === 1 ? "y was" : "ies were"} ` +
        `excluded because the order behind them was cancelled after the list closed.`
    );
  }

  if (entries.length === 0) return { status: "no_entries", draw };

  const selected = selectWinners(entries, prizeSlots, draw.oneWinPerCustomer);

  // Everyone who referred a winner is owed the same prize. One database round
  // trip for the whole set rather than a lookup per winner, and admins are
  // filtered out by the same rule that governs the rest of the affiliate
  // programme (lib/referral.js) — staff are not in it.
  const winnerUserIds = [...new Set(selected.map((item) => item.entry.userId))];
  const referrerRows = await prisma.user.findMany({
    where: { id: { in: winnerUserIds }, referredById: { not: null } },
    select: { id: true, referredBy: { select: { id: true, role: true } } },
  });

  const referrerByWinnerId = new Map(
    referrerRows
      .filter((row) => row.referredBy && canHaveAffiliateId(row.referredBy.role))
      .map((row) => [row.id, row.referredBy.id])
  );

  let wonTheRace = true;

  await prisma.$transaction(async (tx) => {
    // Guard the transition the same way confirmPaidOrder guards a payment: if
    // another admin ran this draw while we were selecting, their winners stand
    // and this whole transaction is abandoned.
    const claimed = await tx.giftDraw.updateMany({
      where: { id: draw.id, status: "FROZEN" },
      data: { status: "DRAWN", drawnAt: new Date(), drawnById: adminUserId ?? null },
    });
    if (claimed.count === 0) {
      wonTheRace = false;
      // Rolls the transaction back, so the winners created below never land.
      throw new AlreadyDrawnError();
    }

    for (const { entry, prizeId } of selected) {
      const winner = await tx.giftDrawWinner.create({
        data: {
          drawId: draw.id,
          prizeId,
          userId: entry.userId,
          couponId: entry.couponId,
          kind: "PRIMARY",
        },
      });

      const referrerId = referrerByWinnerId.get(entry.userId);
      if (!referrerId) continue;

      await tx.giftDrawWinner.create({
        data: {
          drawId: draw.id,
          prizeId,
          userId: referrerId,
          // No coupon: the referrer won nothing of their own. They are owed the
          // prize because of who they referred, and mirroredFromWinnerId is the
          // record of exactly which win earned it.
          couponId: null,
          kind: "REFERRER",
          mirroredFromWinnerId: winner.id,
        },
      });
    }
  }).catch((error) => {
    if (error instanceof AlreadyDrawnError) return null;
    throw error;
  });

  const updated = await getDraw(draw.id);
  if (!wonTheRace) return { status: "already_drawn", draw: updated };

  return { status: "drawn", draw: updated, winners: updated.winners, excluded };
}

/** Thrown inside runDraw's transaction when another caller won the race. */
class AlreadyDrawnError extends Error {}

/**
 * Make a drawn result visible to customers, and tell the winners.
 *
 * Separate from running it so an admin can check the winners — and that nobody
 * has won a prize that cannot actually be delivered — before the store commits
 * to them in public. Publishing is therefore also the right moment to email:
 * the result is final, and an email cannot be taken back.
 *
 * The status flip is guarded by a conditional UPDATE for the same reason the
 * other transitions are. Two admins pressing publish at once must not produce
 * two rounds of winner emails, and only the caller that actually moved the row
 * out of DRAWN goes on to send them.
 */
export async function publishDraw(drawId) {
  const draw = await prisma.giftDraw.findUnique({ where: { id: drawId } });
  if (!draw) return { status: "not_found" };
  if (draw.status === "PUBLISHED") return { status: "already_published", draw };
  if (draw.status !== "DRAWN") return { status: "not_drawn", draw };

  const claimed = await prisma.giftDraw.updateMany({
    where: { id: draw.id, status: "DRAWN" },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  if (claimed.count === 0) {
    return {
      status: "already_published",
      draw: await prisma.giftDraw.findUnique({ where: { id: draw.id } }),
    };
  }

  // Winners are told here and nowhere else. Best-effort: the draw IS published
  // the moment the row flips, and a mail provider outage must not undo that or
  // fail the admin's click. Anyone not reached stays PENDING and is picked up
  // by the resend action.
  let notified = { sent: 0, failed: 0 };
  try {
    notified = await sendGiftDrawWinnerEmails(draw.id);
  } catch (error) {
    console.error(`Could not email winners of draw ${draw.cycleKey}:`, error?.message || error);
  }

  const updated = await prisma.giftDraw.findUnique({ where: { id: draw.id } });
  return { status: "published", draw: updated, notified };
}

// The cover image comes along with each pooled prize: the admin screen shows a
// thumbnail per line, which is the fastest way to spot a prize that is still
// missing its artwork before the draw is published.
const PRIZE_COVER = { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } };

const DRAW_DETAIL_INCLUDE = {
  prizes: { include: { prize: { include: { images: PRIZE_COVER } } } },
  winners: {
    include: {
      prize: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          referralCode: true,
          // The winner's most recent paid order, for its contact details.
          //
          // The account's own `phone` is optional and in practice often unset —
          // signing up needs an email and nothing else — so on its own it is not
          // something the store can plan to ring somebody on. An order is
          // different: it cannot be placed without deliverable contact details,
          // and every winner has at least one, because a coupon is only ever
          // earned by paying for something. Newest rather than the one that
          // earned the winning coupon: a customer who has moved house or changed
          // number since is reachable on the number they used last, not the one
          // attached to a coupon minted months ago.
          orders: {
            where: { paymentStatus: "PAID", status: { not: "CANCELLED" } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { orderNumber: true, addressSnapshot: true },
          },
        },
      },
      coupon: { select: { id: true, code: true } },
      // On a REFERRER row, the customer whose win earned it. The row is
      // otherwise unreadable: a referrer holds no coupon and did nothing to be
      // there, so "Referrer" on its own leaves an admin working down the list
      // with no way to see WHY this person is owed a prize, or to reach the
      // buyer who can vouch for them — which matters here more than on a
      // primary row, because a referrer need never have bought anything and so
      // may have no phone number and no address anywhere in the store.
      mirroredFrom: {
        select: {
          id: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
    },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  },
  drawnBy: { select: { id: true, name: true } },
};

/**
 * Everything needed to actually reach one winner, gathered from both places the
 * store holds it.
 *
 * This exists because handing a prize over is a phone call, not an email: the
 * winner has to be told where to come and when. The winner email promises that
 * call, so the admin screen has to be able to make it — which means the numbers
 * have to be on the winners table itself rather than several clicks away in the
 * customer record, where an admin working through a list will not go looking.
 *
 * Numbers are collected from the account and from the last order's snapshot and
 * de-duplicated, because they are usually the same one and a list that shows it
 * twice reads as two different contacts. Order matters: the account number goes
 * first when there is one, being the number the customer chose to be reached on
 * rather than the one they had a parcel sent to.
 */
function winnerContact(user) {
  const snapshot = user?.orders?.[0]?.addressSnapshot ?? null;
  const fromSnapshot = (key) => {
    const value = snapshot && typeof snapshot === "object" ? snapshot[key] : null;
    const trimmed = String(value ?? "").trim();
    return trimmed || null;
  };

  // A Set keyed on the digits alone, so "+971 52 101 8945" and "+971521018945"
  // are recognised as one number rather than listed as two.
  const phones = [];
  const seen = new Set();
  for (const candidate of [user?.phone, fromSnapshot("phone"), fromSnapshot("phone2")]) {
    const value = String(candidate ?? "").trim();
    if (!value) continue;
    const key = value.replace(/\D/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    phones.push(value);
  }

  const whatsapp = fromSnapshot("whatsapp");

  return {
    phones,
    // Where they live, exactly as the invoice and the courier email print it.
    // Not for posting the prize — these are collected in person — but because
    // "which emirate are they in?" is the first thing that decides WHICH place
    // the admin tells them to come to, and the landmark line is often the only
    // way to tell two customers with the same name apart on the phone.
    //
    // Postal lines only. The numbers and addresses are rendered above as things
    // that can be dialled and clicked, and repeating them inside this block
    // would show the same contact twice.
    addressLines: formatPostalLines(snapshot),
    // Only worth showing separately when it is a different number from the ones
    // already listed — most customers give the same one.
    whatsapp: whatsapp && !seen.has(whatsapp.replace(/\D/g, "")) ? whatsapp : null,
    // The account address is the one the store's own emails go to; the order
    // snapshot's is whatever they typed at checkout, which is worth having when
    // the two differ.
    email: user?.email ?? null,
    orderEmail: fromSnapshot("email") !== user?.email ? fromSnapshot("email") : null,
    orderNumber: user?.orders?.[0]?.orderNumber ?? null,
  };
}

/** One draw with everything the admin detail screen renders. */
export async function getDraw(drawId) {
  const draw = await prisma.giftDraw.findUnique({
    where: { id: drawId },
    include: DRAW_DETAIL_INCLUDE,
  });
  if (!draw) return draw;

  // Flattened onto the winner rather than left for the screen to dig out of a
  // JSON blob: the admin API is the right place to decide which of two stored
  // phone numbers is the one to ring, and doing it here means the raw address
  // snapshot — a whole delivery address — never has to be shipped to the
  // browser just to read a phone number off it.
  return {
    ...draw,
    winners: draw.winners.map(({ user, ...winner }) => ({
      ...winner,
      user: { id: user.id, name: user.name, email: user.email, referralCode: user.referralCode },
      contact: winnerContact(user),
    })),
  };
}

/** Draws for the admin list, newest first. */
export async function listDraws() {
  return prisma.giftDraw.findMany({
    orderBy: { drawDate: "desc" },
    include: {
      prizes: { include: { prize: { select: { id: true, name: true } } } },
      _count: { select: { winners: true, entries: true } },
    },
  });
}

/**
 * The prizes to advertise on /gifts, in the order they should be shown.
 *
 * Two sources, deliberately in this priority:
 *
 *   1. The pool of the draw that is actually open. This is what the store is
 *      genuinely giving away next, so it is what the page should sell — and it
 *      is the reason a prize created while assembling a draw appears on the
 *      storefront without anybody remembering to also tick "feature" on it.
 *   2. Featured prizes not already in that pool. These are the standing
 *      headliners, and they still belong on the page before a draw is opened —
 *      otherwise /gifts would advertise nothing at all between draws.
 *
 * Merged rather than one-or-the-other so a store can lead with the villa it
 * always features AND the phone in this month's draw, without the two lists
 * fighting over the same slot. `quantity` is carried through from the pool
 * because "× 3" is a selling point; a featured prize not in the draw has none.
 */
export async function getShowcasePrizes(limit = 9) {
  const open = await prisma.giftDraw.findFirst({
    where: { status: "SCHEDULED" },
    orderBy: { drawDate: "asc" },
    select: {
      prizes: {
        where: { prize: { isActive: true } },
        include: {
          prize: {
            select: {
              id: true,
              name: true,
              valueNote: true,
              images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true } },
            },
          },
        },
      },
    },
  });

  const pooled = (open?.prizes ?? []).map((row) => ({
    ...row.prize,
    // Only worth printing when there is more than one to win.
    quantity: row.quantity > 1 ? row.quantity : null,
  }));

  const pooledIds = new Set(pooled.map((prize) => prize.id));

  const featured = await prisma.giftPrize.findMany({
    where: { isActive: true, isFeatured: true, id: { notIn: [...pooledIds] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: Math.max(0, limit - pooled.length),
    select: {
      id: true,
      name: true,
      valueNote: true,
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true } },
    },
  });

  return [...pooled, ...featured.map((prize) => ({ ...prize, quantity: null }))].slice(0, limit);
}

/**
 * Published winners for the public /gifts page.
 *
 * Names are masked by the caller — winning a car should not publish somebody's
 * full name next to the fact that they own one.
 */
export async function getPublishedDraws(limit = 3) {
  return prisma.giftDraw.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { drawDate: "desc" },
    take: limit,
    include: {
      winners: {
        include: {
          prize: { select: { id: true, name: true } },
          user: { select: { name: true } },
        },
        orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}
