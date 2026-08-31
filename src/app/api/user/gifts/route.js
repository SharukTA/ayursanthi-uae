import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCouponsForUser, getQualifyingSpend } from "@/lib/gift-coupons";
import { getGiftCouponThreshold, isGiftProgramEnabled } from "@/lib/settings";
import { getUpcomingDraw } from "@/lib/gift-draw";
import { getGiftPosters } from "@/lib/gift-posters";
import { isWithinCycle } from "@/lib/gift-shared";

export const runtime = "nodejs";

// GET /api/user/gifts — this customer's coupons and prizes.
//
// "Active" is computed here rather than stored, because it is a question about
// a moving target: a coupon is active for the NEXT draw, and which draw that is
// changes the moment one closes — or the moment an admin schedules the next —
// without anything touching the coupon row.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  // Read-only: a customer opening their coupons must not be the thing that
  // opens the next draw. Null only when no valid date is configured, which is
  // the state between a draw closing and an admin scheduling the next one.
  const upcoming = await getUpcomingDraw();

  const [coupons, wins, threshold, enabled, spend, posters] = await Promise.all([
    getCouponsForUser(session.userId),
    prisma.giftDrawWinner.findMany({
      where: {
        userId: session.userId,
        // Only what the store has actually announced. A winner must not read
        // their result off this endpoint before the admin has reviewed and
        // published the draw.
        draw: { status: "PUBLISHED" },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        status: true,
        createdAt: true,
        prize: { select: { name: true, valueNote: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } },
        coupon: { select: { code: true } },
        draw: { select: { cycleKey: true, drawDate: true } },
      },
    }),
    getGiftCouponThreshold(),
    isGiftProgramEnabled(),
    getQualifyingSpend(session.userId),
    // The campaign artwork, so the customer's own gifts screen advertises the
    // same giveaway the storefront does rather than describing it in words that
    // drift out of step with the poster.
    getGiftPosters("DASHBOARD", 4),
  ]);

  // How far into the current 100 AED the customer is, and what is left to go.
  // Coupons are earned on cumulative spend, so "spend 40 AED more" is the single
  // most useful thing this page can tell somebody — without it the rule is
  // invisible and a 20 AED order looks like it achieved nothing.
  const towardsNext = threshold > 0 ? Math.max(0, spend % threshold) : 0;
  const remainingToNext = threshold > 0 ? Math.round((threshold - towardsNext) * 100) / 100 : 0;

  const decorated = coupons.map((coupon) => ({
    id: coupon.id,
    code: coupon.code,
    createdAt: coupon.createdAt,
    voidedAt: coupon.voidedAt,
    voidReason: coupon.voidReason,
    order: coupon.sourceOrder,
    // A voided coupon is never active, whatever its stamp says. With no draw
    // scheduled nothing is active — there is no window to fall inside — and the
    // dashboard says so rather than showing a count against a date that does
    // not exist.
    active:
      !coupon.voidedAt &&
      Boolean(upcoming) &&
      isWithinCycle(coupon.lastQualifiedAt, upcoming.cycleStart, upcoming.cycleEnd),
  }));

  return Response.json({
    enabled,
    threshold,
    posters,
    // The announced draw, or nulls while none is scheduled. The dashboard reads
    // `drawScheduled` rather than inferring it from a date, so "no draw booked
    // yet" and "draw on the 31st" are two states it renders deliberately
    // instead of one date field it has to guess about.
    drawScheduled: Boolean(upcoming) && upcoming.cycleEnd.getTime() > Date.now(),
    cycleKey: upcoming?.cycleKey ?? null,
    drawDate: upcoming?.drawDate ?? null,
    cycleStart: upcoming?.cycleStart ?? null,
    coupons: decorated,
    activeCount: decorated.filter((coupon) => coupon.active).length,
    wins,
    // Cumulative-spend progress.
    spend,
    towardsNext,
    remainingToNext,
  });
}
