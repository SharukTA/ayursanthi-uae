/**
 * Gift draw emails.
 *
 * Exactly one template: telling somebody they have won. Nothing else in the
 * programme is emailed, and that is deliberate — a coupon is shown on the
 * checkout success page and in /dashboard/gifts rather than mailed, because the
 * store sends about three messages per order already and a fourth to hand over
 * a code the customer can see on screen is not worth the sending quota (see the
 * volume note in lib/email-orders.js).
 *
 * A win is different. It is the one thing in the programme a customer cannot
 * reasonably be expected to discover on their own: nothing prompts them to open
 * the gifts page on the draw day, and a prize nobody claims is worse
 * than a coupon nobody reads about. Volume is bounded by the number of winners
 * in a draw, which is a handful a month, not per order.
 *
 * Sent when the admin PUBLISHES a draw, never when they run it — running it is
 * a private step whose result is still under review, and mailing a winner list
 * that has not been checked is not something that can be taken back.
 */

import { prisma } from "@/lib/prisma";
import {
  escapeHtml,
  getBrandContext,
  renderButton,
  renderEmailLayout,
  renderInfoRows,
  sendEmail,
} from "@/lib/email";
import { formatDrawDate } from "@/lib/gift-shared";

function firstName(name) {
  return (name || "there").trim().split(/\s+/)[0];
}

function paragraphs(...lines) {
  return lines
    .filter(Boolean)
    .map(
      (line) =>
        `                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(line)}</p>`
    )
    .join("\n");
}

function heading(text) {
  return `                <p style="margin:0 0 16px;font-size:16px;font-weight:bold;">${escapeHtml(text)}</p>`;
}

/**
 * Tell one winner what they have won.
 *
 * Handles both kinds of win, because they are genuinely different messages: a
 * PRIMARY winner had their coupon drawn, while a REFERRER won nothing of their
 * own and is owed the prize because somebody they introduced to the store won.
 * Sending the first wording to the second person would read as a mistake.
 *
 * Marks the winner NOTIFIED on success. That is what stops a republish mailing
 * the same person twice, and it is only written when the provider actually
 * accepted the message — a failed send leaves the row PENDING so it can be
 * retried, and an admin can still set the status by hand.
 *
 * @param {string} winnerId
 */
export async function sendGiftWinnerEmail(winnerId) {
  const winner = await prisma.giftDrawWinner.findUnique({
    where: { id: winnerId },
    include: {
      prize: { select: { name: true } },
      coupon: { select: { code: true } },
      draw: { select: { cycleKey: true, drawDate: true, status: true } },
      user: { select: { name: true, email: true } },
      // The referred customer whose win earned this one, for the REFERRER
      // wording. Null on a PRIMARY row.
      mirroredFrom: { select: { user: { select: { name: true } } } },
    },
  });

  if (!winner?.user?.email) return { ok: false, skipped: true };

  // Belt and braces against a caller reaching this before the admin published.
  // The published draw is the only version of the result the store has
  // committed to, and an email is not retractable.
  if (winner.draw.status !== "PUBLISHED") return { ok: false, skipped: true };
  if (winner.status !== "PENDING") return { ok: false, skipped: true };

  const { brand, supportEmail, siteUrl } = await getBrandContext();
  const isReferrer = winner.kind === "REFERRER";
  const referredName = winner.mirroredFrom?.user?.name
    ? firstName(winner.mirroredFrom.user.name)
    : null;

  const bodyHtml = [
    heading(`Congratulations ${firstName(winner.user.name)}!`),
    paragraphs(
      isReferrer
        ? `Someone you referred to ${brand} has won a prize in our ${formatDrawDate(winner.draw.drawDate)} gift draw — and because you referred them, you receive the same prize.`
        : `Your gift coupon was drawn in our ${formatDrawDate(winner.draw.drawDate)} gift draw.`,
      `You have won: ${winner.prize.name}.`,
      isReferrer && referredName
        ? `${referredName} was the winner your referral is linked to. Thank you for introducing them to us.`
        : null
    ),
    renderInfoRows(
      [
        ["Prize", winner.prize.name],
        ["Draw", formatDrawDate(winner.draw.drawDate)],
        winner.coupon ? ["Winning coupon", winner.coupon.code] : null,
        isReferrer ? ["How you won", "Referral reward"] : null,
      ].filter(Boolean)
    ),
    paragraphs(
      `Our team will be in touch shortly to arrange handing your prize over. If you have not heard from us within a few days, just reply to this email.`
    ),
    renderButton(`${siteUrl}/dashboard/gifts`, "View my gifts"),
  ].join("\n");

  const result = await sendEmail({
    to: winner.user.email,
    subject: isReferrer
      ? `You've won ${winner.prize.name} — someone you referred won our gift draw`
      : `Congratulations! You've won ${winner.prize.name}`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text: [
      `Congratulations ${firstName(winner.user.name)}!`,
      "",
      isReferrer
        ? `Someone you referred has won a prize in our ${formatDrawDate(winner.draw.drawDate)} gift draw, and you receive the same prize.`
        : `Your gift coupon was drawn in our ${formatDrawDate(winner.draw.drawDate)} gift draw.`,
      "",
      `You have won: ${winner.prize.name}`,
      winner.coupon ? `Winning coupon: ${winner.coupon.code}` : null,
      "",
      `Our team will be in touch shortly to arrange handing your prize over.`,
      `${siteUrl}/dashboard/gifts`,
    ]
      .filter((line) => line !== null)
      .join("\n"),
    template: isReferrer ? "gift_winner_referrer" : "gift_winner",
  });

  if (result?.ok) {
    await prisma.giftDrawWinner.update({
      where: { id: winner.id },
      data: { status: "NOTIFIED" },
    });
  }

  return result;
}

/**
 * Mail every unnotified winner of a published draw.
 *
 * Sequential rather than parallel: this fires on a single admin click and the
 * provider rate-limits, so a burst of concurrent sends on a large draw is the
 * one thing likely to get messages dropped. A draw has at most a few dozen
 * winners, so the wall-clock cost is irrelevant.
 *
 * One winner failing must not stop the rest, so each send is caught
 * individually. Anyone missed stays PENDING and keeps their row in the admin
 * list, where the status can be set by hand.
 *
 * @param {string} drawId
 * @returns {Promise<{sent: number, failed: number}>}
 */
export async function sendGiftDrawWinnerEmails(drawId) {
  const winners = await prisma.giftDrawWinner.findMany({
    where: { drawId, status: "PENDING", draw: { status: "PUBLISHED" } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  let sent = 0;
  let failed = 0;

  for (const winner of winners) {
    try {
      const result = await sendGiftWinnerEmail(winner.id);
      if (result?.ok) sent += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      console.error(`Could not email gift winner ${winner.id}:`, error?.message || error);
    }
  }

  return { sent, failed };
}
