import {
  adminRecipient,
  escapeHtml,
  formatMoney,
  getBrandContext,
  renderButton,
  renderEmailLayout,
  renderInfoRows,
  sendEmail,
} from "@/lib/email";
import { findShopTier, SHOP_ATTRIBUTION_DAYS } from "@/lib/shop-shared";

/**
 * Emails for the My Shop join requests: the alert to the admin when someone applies,
 * and the shop code to the applicant once they are approved.
 */

function paragraph(text) {
  return `                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(text)}</p>`;
}

function labelledParagraph(label, text) {
  return `                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(text)}</p>`;
}

// What a new partner finds at /my-shop, for the approval email.
const SHOP_PAGE_GUIDE = [
  [
    "Your link for ads",
    `Use this link in your social media ads, posts and messages. You can link to the home page or to a product. When someone opens the website through your link and buys within ${SHOP_ATTRIBUTION_DAYS} days, you earn your profit on that purchase.`,
  ],
  [
    "Your shop referral code",
    "Give this code to people who want to join the business partnership. They enter it on the join form, and once they are approved, you also earn a share of every purchase made through their link.",
  ],
  [
    "Your sales and profit",
    "See your revenue, stock sold, profit and payments.",
  ],
];

/** Non-critical, so wrap it in queueEmail(): the request is already saved. */
export async function sendShopRequestAdminEmail(request, referrer = null) {
  const to = adminRecipient();
  if (!to) return;

  const { brand, supportEmail, siteUrl } = await getBrandContext();
  const tier = findShopTier(request.investmentAed);
  const investment = formatMoney(request.investmentAed, { decimals: 0 });
  const referredBy = referrer
    ? `${referrer.ownerName}${referrer.sameContact ? " (has the same email or mobile as this applicant)" : ""}`
    : null;

  const bodyHtml = [
    paragraph("Someone has asked to join the business partnership."),
    renderInfoRows([
      ["Name", request.ownerName],
      ["Phone", request.phone],
      ["Email", request.email],
      ["Investment", investment],
      tier ? ["Profit rate", `${tier.commissionRate}%`] : null,
      referredBy ? ["Referred by", referredBy] : null,
    ]),
    renderButton(`${siteUrl}/admin/shops`, "Open in admin"),
  ].join("\n");

  await sendEmail({
    to,
    template: "admin_shop_request",
    subject: `New partnership request: ${request.ownerName}`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text: `New partnership request\nName: ${request.ownerName}\nPhone: ${request.phone}\nEmail: ${request.email}\nInvestment: ${investment}${referredBy ? `\nReferred by: ${referredBy}` : ""}\n\n${siteUrl}/admin/shops`,
  });
}

/** Non-critical, so wrap it in queueEmail(): the request is already saved. */
export async function sendShopWithdrawalAdminEmail({ shop, amount, available }) {
  const to = adminRecipient();
  if (!to) return;

  const { brand, supportEmail, siteUrl } = await getBrandContext();

  const bodyHtml = [
    paragraph(`${shop.ownerName} has asked to withdraw their profit.`),
    renderInfoRows([
      ["Amount", formatMoney(amount)],
      ["Available", formatMoney(available)],
      ["Phone", shop.phone],
      ["Email", shop.email],
    ]),
    renderButton(`${siteUrl}/admin/shops`, "Open in admin"),
  ].join("\n");

  await sendEmail({
    to,
    template: "admin_shop_withdrawal",
    subject: `Withdrawal request: ${shop.ownerName}, ${formatMoney(amount)}`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text: `${shop.ownerName} has asked to withdraw ${formatMoney(amount)} (${formatMoney(available)} available).\nPhone: ${shop.phone}\nEmail: ${shop.email}\n\n${siteUrl}/admin/shops`,
  });
}

/** Non-critical, so wrap it in queueEmail(): the request is already saved. */
export async function sendShopInvestmentChangeAdminEmail({ shop, tier }) {
  const to = adminRecipient();
  if (!to) return;

  const { brand, supportEmail, siteUrl } = await getBrandContext();
  const current = `${formatMoney(shop.investmentAed, { decimals: 0 })} (${shop.commissionRate}%)`;
  const requested = `${formatMoney(tier.investmentAed, { decimals: 0 })} (${tier.commissionRate}%)`;

  const bodyHtml = [
    paragraph(`${shop.ownerName} has asked to change their investment.`),
    renderInfoRows([
      ["Current", current],
      ["Requested", requested],
      ["Phone", shop.phone],
      ["Email", shop.email],
    ]),
    renderButton(`${siteUrl}/admin/shops`, "Open in admin"),
  ].join("\n");

  await sendEmail({
    to,
    template: "admin_shop_investment_change",
    subject: `Investment change request: ${shop.ownerName}`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text: `${shop.ownerName} has asked to change their investment.\nCurrent: ${current}\nRequested: ${requested}\nPhone: ${shop.phone}\nEmail: ${shop.email}\n\n${siteUrl}/admin/shops`,
  });
}

/**
 * Tells an owner about something done from their shop, in case it was not them. Someone
 * with a stolen shop code could do any of these. Non-critical, so wrap it in queueEmail().
 */
export async function sendShopActivityNotice({ ownerName, to, message }) {
  const { brand, supportEmail } = await getBrandContext();
  const warning = "If this was not you, please contact us straight away so we can replace your shop code.";

  await sendEmail({
    to,
    template: "shop_activity_notice",
    subject: `Activity on your ${brand} shop`,
    html: renderEmailLayout({
      brand,
      supportEmail,
      bodyHtml: [paragraph(`Hello ${ownerName},`), paragraph(message), paragraph(warning)].join("\n"),
    }),
    text: `Hello ${ownerName},\n\n${message}\n\n${warning}`,
  });
}

/**
 * The code that proves an owner can read the email they are changing to. The caller
 * awaits this, since they are waiting for it. The code stays out of the subject, because
 * subjects are written to EmailLog.
 *
 * @returns {Promise<{ok: boolean}>}
 */
export async function sendShopEmailChangeCodeEmail({ ownerName, to, otp }) {
  const { brand, supportEmail } = await getBrandContext();

  const bodyHtml = [
    paragraph(`Hello ${ownerName},`),
    paragraph("Use this code to confirm the new email for your shop. It expires in 10 minutes."),
    `                <p style="margin:0 0 24px;text-align:center;">
                  <span style="display:inline-block;background:#f0fdfa;border:1px solid #99f6e4;color:#0f766e;font-size:24px;font-weight:bold;letter-spacing:4px;padding:14px 24px;border-radius:10px;">${escapeHtml(otp)}</span>
                </p>`,
    paragraph("If you did not ask for this, you can ignore this email."),
  ].join("\n");

  return sendEmail({
    to,
    template: "shop_email_change_code",
    subject: `Confirm your new ${brand} shop email`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text: `Hello ${ownerName},\n\nYour code to confirm the new email for your shop: ${otp}\n\nIt expires in 10 minutes. If you did not ask for this, you can ignore this email.`,
  });
}

/** Tells the old address, so an owner whose shop was opened by someone else finds out. */
export async function sendShopEmailChangedNotice({ ownerName, to, newEmail }) {
  const { brand, supportEmail } = await getBrandContext();
  const message = `The email for your shop was changed to ${newEmail}. We will use it to contact you. Your shop code has not changed.`;
  const warning = "If you did not do this, please contact us straight away.";

  await sendEmail({
    to,
    template: "shop_email_changed",
    subject: `Your ${brand} shop email was changed`,
    html: renderEmailLayout({
      brand,
      supportEmail,
      bodyHtml: [paragraph(`Hello ${ownerName},`), paragraph(message), paragraph(warning)].join("\n"),
    }),
    text: `Hello ${ownerName},\n\n${message}\n\n${warning}`,
  });
}

/**
 * Sends a newly approved partner their shop code. The caller awaits this, because
 * the code cannot be recovered later and the admin must be told if it did not go.
 *
 * The code stays out of the subject line: the subject is written to EmailLog, and
 * only the body is kept out of it.
 *
 * @returns {Promise<{ok: boolean}>}
 */
export async function sendShopApprovedEmail({ ownerName, email, code }) {
  const { brand, supportEmail, siteUrl } = await getBrandContext();

  const bodyHtml = [
    paragraph(`Hello ${ownerName},`),
    paragraph("Your shop has been approved. This is your shop code:"),
    `                <p style="margin:0 0 24px;text-align:center;">
                  <span style="display:inline-block;background:#f0fdfa;border:1px solid #99f6e4;color:#0f766e;font-size:24px;font-weight:bold;letter-spacing:2px;padding:14px 24px;border-radius:10px;">${escapeHtml(code)}</span>
                </p>`,
    paragraph(
      "To open your shop, enter this code on the View My Shop page. Keep it private and do not share it in your ads, because anyone who has it can open your shop."
    ),
    paragraph("In your shop you will find:"),
    ...SHOP_PAGE_GUIDE.map(([label, description]) => labelledParagraph(label, description)),
    renderButton(`${siteUrl}/my-shop`, "View my shop"),
  ].join("\n");

  return sendEmail({
    to: email,
    template: "shop_approved",
    subject: `Your ${brand} shop is approved`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text: `Hello ${ownerName},\n\nYour shop has been approved.\n\nYour shop code: ${code}\n\nTo open your shop, enter this code on the View My Shop page: ${siteUrl}/my-shop\n\nKeep it private and do not share it in your ads, because anyone who has it can open your shop.\n\nIn your shop you will find:\n\n${SHOP_PAGE_GUIDE.map(([label, description]) => `${label}: ${description}`).join("\n\n")}`,
  });
}
