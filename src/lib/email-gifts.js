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

/**
 * The gold "you won" band that opens the email.
 *
 * A table cell with a background colour rather than anything cleverer, because
 * this has to survive Outlook: no gradients, no background images, no flexbox.
 * The emoji carry the celebration instead — they are plain text characters, so
 * they render in every client that can show the message at all, where a
 * decorative image would be stripped by the same image blocking that hides the
 * prize photo below.
 *
 * The heading is the ONE thing a winner must be able to read in the preview
 * pane before they trust the mail enough to open it, which is why it is the
 * first thing in the body and not preceded by a greeting.
 */
function renderCelebrationBanner(title, subtitle) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:separate;">
  <tr>
    <td style="background:#fffbeb;border:2px solid #fbbf24;border-radius:12px;padding:24px 20px;text-align:center;">
      <p style="margin:0 0 6px;font-size:26px;line-height:1;">&#127881; &#127882; &#127881;</p>
      <p style="margin:0;font-size:22px;font-weight:bold;color:#92400e;line-height:1.3;">${escapeHtml(title)}</p>
      <p style="margin:8px 0 0;font-size:14px;color:#a16207;line-height:1.5;">${escapeHtml(subtitle)}</p>
    </td>
  </tr>
</table>`;
}

/**
 * The prize itself: its photograph, its name, and what it is worth.
 *
 * The picture is the point of this email — "you have won" lands very
 * differently next to a photograph of the thing — but it is also the part most
 * likely not to arrive. Most clients block remote images until the reader
 * allows them, and a prize can be created with an empty gallery (most of the
 * catalogue currently has none). So the name is rendered as text UNDERNEATH the
 * image rather than over it, the img carries an `alt`, and the whole picture
 * block is omitted when there is no photograph rather than leaving a broken
 * frame. The email reads correctly in all three cases.
 *
 * Width is set as an attribute as well as a style: Outlook ignores CSS on
 * images, and an unconstrained 4000px photo from a phone camera would otherwise
 * blow the 600px shell apart.
 */
function renderPrizeCard({ name, valueNote, imageUrl }) {
  const picture = imageUrl
    ? `      <tr>
        <td style="padding:0;">
          <img src="${escapeHtml(imageUrl)}" width="536" alt="${escapeHtml(name)}" style="display:block;width:100%;max-width:536px;height:auto;border-radius:8px 8px 0 0;border:0;" />
        </td>
      </tr>
`
    : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
${picture}      <tr>
        <td style="padding:16px 20px;text-align:center;background:#ffffff;">
          <p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#64748b;">Your prize</p>
          <p style="margin:6px 0 0;font-size:20px;font-weight:bold;color:#0f172a;line-height:1.3;">${escapeHtml(name)}</p>
          ${valueNote ? `<p style="margin:4px 0 0;font-size:14px;font-weight:bold;color:#067d62;">${escapeHtml(valueNote)}</p>` : ""}
        </td>
      </tr>
    </table>`;
}

/**
 * What happens next, and it is the most practical block in the email.
 *
 * A prize is worthless to somebody who does not know how to get hold of it, and
 * "we will be in touch" on its own invites a week of wondering whether the mail
 * was a scam. So this names the channel (the phone number and email the store
 * holds), gives a window to expect it in, and tells them what to do if it
 * does not arrive — a reply address they can use rather than a support page
 * they have to go and find.
 */
function renderCollectionNote({ supportEmail }) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
  <tr>
    <td style="padding:16px 20px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#166534;">&#128230; Collecting your prize</p>
      <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#14532d;">
        Our team will contact you within 2 working days on the phone number and email address we
        have for you, to arrange where and when to collect your prize.
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#3f6212;">
        Nothing to pay, and nothing to do right now &mdash; just keep an eye on your phone. If you have not
        heard from us in a few days, reply to this email or write to
        <a href="mailto:${escapeHtml(supportEmail)}" style="color:#166534;font-weight:bold;">${escapeHtml(supportEmail)}</a>.
      </p>
    </td>
  </tr>
</table>`;
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
      // The cover photograph comes along for the prize card. Lowest sortOrder
      // first and only one taken: the email shows the cover and nothing else,
      // exactly as the schema says every card and thumbnail does.
      prize: {
        select: {
          name: true,
          valueNote: true,
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
        },
      },
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
    renderCelebrationBanner(
      `Congratulations, ${firstName(winner.user.name)}!`,
      isReferrer
        ? `Someone you referred has won our ${formatDrawDate(winner.draw.drawDate)} gift draw — and so have you.`
        : `You are a winner of our ${formatDrawDate(winner.draw.drawDate)} gift draw.`
    ),
    renderPrizeCard({
      name: winner.prize.name,
      valueNote: winner.prize.valueNote,
      imageUrl: winner.prize.images?.[0]?.url ?? null,
    }),
    paragraphs(
      isReferrer
        ? `Someone you referred to ${brand} has won a prize in our ${formatDrawDate(winner.draw.drawDate)} gift draw — and because you referred them, you receive the same prize.`
        : `Your gift coupon was drawn at random from every coupon in play when the draw closed.`,
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
    renderCollectionNote({ supportEmail }),
    renderButton(`${siteUrl}/dashboard/gifts`, "View my prize"),
  ].join("\n");

  const result = await sendEmail({
    to: winner.user.email,
    subject: isReferrer
      ? `🎉 You've won ${winner.prize.name} — someone you referred won our gift draw`
      : `🎉 Congratulations! You've won ${winner.prize.name}`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    // The plain-text alternative every message carries for clients that will not
    // render HTML. It says the same things in the same order — including how the
    // prize is collected, which is the one part a winner genuinely needs and
    // must not be reachable only through the styled version.
    text: [
      `Congratulations ${firstName(winner.user.name)}!`,
      "",
      isReferrer
        ? `Someone you referred has won a prize in our ${formatDrawDate(winner.draw.drawDate)} gift draw, and you receive the same prize.`
        : `Your gift coupon was drawn in our ${formatDrawDate(winner.draw.drawDate)} gift draw.`,
      "",
      `You have won: ${winner.prize.name}`,
      winner.prize.valueNote ? `Value: ${winner.prize.valueNote}` : null,
      winner.coupon ? `Winning coupon: ${winner.coupon.code}` : null,
      "",
      "COLLECTING YOUR PRIZE",
      `Our team will contact you within 2 working days on the phone number and email address we have for you, to arrange where and when to collect your prize.`,
      `Nothing to pay, and nothing to do right now. If you have not heard from us in a few days, reply to this email or write to ${supportEmail}.`,
      "",
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
