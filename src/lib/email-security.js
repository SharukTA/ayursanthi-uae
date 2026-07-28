/**
 * Account-security notifications — the "Was this you?" emails.
 *
 * These are not courtesy messages. When an account is taken over, this email is
 * the only signal the real owner gets, and it lands in the one place the
 * attacker does not control: the registered inbox. So they are sent even when
 * the change was legitimate, and they always say what changed and when.
 *
 * Never fail the user's action because of one of these — callers wrap them in
 * queueEmail(), and sendEmail() swallows and logs delivery errors itself.
 */

import {
  escapeHtml,
  getBrandContext,
  renderButton,
  renderEmailLayout,
  renderInfoRows,
  sendEmail,
} from "@/lib/email";

/** Copy per alert kind. `lead` is the one-line "what just happened". */
const ALERTS = {
  password_reset: {
    subject: (brand) => `Your ${brand} password was reset`,
    lead: "Your account password was just reset using a one-time code sent to this email address.",
  },
  password_changed: {
    subject: (brand) => `Your ${brand} password was changed`,
    lead: "The password on your account was just changed from a signed-in session.",
  },
  profile_changed: {
    subject: (brand) => `Your ${brand} account details were updated`,
    lead: "The contact details on your account were just updated.",
  },
};

function firstName(name) {
  return (name || "there").trim().split(/\s+/)[0];
}

/**
 * Send an account-security alert.
 *
 * @param {{ name?: string, email?: string|null }} user
 * @param {"password_reset"|"password_changed"|"profile_changed"} kind
 * @param {{ changes?: Array<[string, string]> }} [options]
 *        `changes` are extra rows to show, e.g. [["Phone", "+9715… → +9715…"]].
 */
export async function sendSecurityAlertEmail(user, kind, { changes = [] } = {}) {
  const alert = ALERTS[kind];
  if (!alert || !user?.email) return;

  const { brand, supportEmail, siteUrl } = await getBrandContext();
  const when = new Date().toUTCString();

  // The recovery link is deliberately the password-reset flow rather than a
  // login link: if this alert is a surprise, the attacker knows the current
  // password and the only useful action is to change it.
  const recoverUrl = `${siteUrl}/forgot-password`;

  const bodyHtml = [
    `                <p style="margin:0 0 16px;font-size:16px;font-weight:bold;">${escapeHtml(`Hi ${firstName(user.name)},`)}</p>`,
    `                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(alert.lead)}</p>`,
    renderInfoRows([["When", when], ...changes]),
    `                <p style="margin:0 0 8px;font-size:15px;line-height:1.6;"><strong>If this was you, no action is needed.</strong></p>`,
    `                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">If it wasn't, reset your password straight away and email us at <a href="mailto:${escapeHtml(supportEmail)}" style="color:#156c6b;">${escapeHtml(supportEmail)}</a> so we can secure your account.</p>`,
    renderButton(recoverUrl, "Secure my account"),
  ].join("\n");

  const changesText = changes.map(([label, value]) => `${label}: ${value}`).join("\n");

  const text = `Hi ${firstName(user.name)},

${alert.lead}

When: ${when}${changesText ? `\n${changesText}` : ""}

If this was you, no action is needed.

If it wasn't, reset your password straight away at ${recoverUrl} and email ${supportEmail} so we can secure your account.`;

  await sendEmail({
    to: user.email,
    subject: alert.subject(brand),
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text,
    template: kind,
  });
}
