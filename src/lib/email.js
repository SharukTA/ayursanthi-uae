/**
 * Email module — provider-agnostic transactional email sender.
 *
 * Configured entirely through environment variables and HTTP (no SMTP library /
 * extra dependency), so the app stays portable and works out-of-the-box in
 * development.
 *
 *   EMAIL_PROVIDER   "resend" (default) | "console"
 *   EMAIL_FROM       From header, e.g. "Ayurshoppee <orders@send.ayurshoppee.ae>"
 *   EMAIL_REPLY_TO   Where customer replies land — the From address is a
 *                    send-only identity with no mailbox behind it.
 *   RESEND_API_KEY   Resend account API key (https://resend.com)
 *   LOGISTICS_EMAIL  The courier desk's shared mailbox — where the dispatch
 *                    instruction for every paid order is sent. Not a
 *                    notification address: nothing ships without it. See
 *                    lib/email-logistics.js.
 *
 * If the required credentials are missing, the module falls back to a console
 * "sender" that logs the message instead of throwing. Signup therefore works
 * immediately in dev and goes live the moment real credentials are added — no
 * code changes required.
 *
 * Adding a provider (Brevo, SES, ...) means writing one function shaped like
 * sendViaResend() and a case in resolveProvider(). Templates and call sites
 * never change.
 */

import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/settings";
import { CURRENCY, formatMoney } from "@/lib/currency";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Money formatting now lives in lib/currency.js so email, the storefront, the
 * admin and the PDF invoice can never disagree about how a price is written.
 * Re-exported here because the email templates below and lib/email-orders.js
 * already import it from this module.
 */
export { CURRENCY as EMAIL_CURRENCY, formatMoney };

/** Very small sanity check — the API already validates the address. */
function looksLikeEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Resolve which provider to use. Falls back to "console" whenever the
 * credentials needed for a real send are absent.
 *
 * @returns {"resend" | "console"}
 */
function resolveProvider() {
  const provider = (process.env.EMAIL_PROVIDER || "resend").toLowerCase();
  if (provider === "resend" && process.env.RESEND_API_KEY) return "resend";
  return "console";
}

/**
 * Normalise the `to` option into a list of deliverable addresses.
 *
 * Accepts a single address or a list, drops blanks and anything that isn't
 * shaped like an address, and de-duplicates case-insensitively — an order whose
 * shipping email matches the account email must not send the customer two
 * copies of the same message.
 *
 * Order is preserved, so the first address given stays the primary recipient.
 *
 * @param {string|string[]|null|undefined} to
 * @returns {string[]}
 */
function normaliseRecipients(to) {
  const list = Array.isArray(to) ? to : [to];
  const seen = new Set();
  const out = [];

  for (const entry of list) {
    const address = String(entry ?? "").trim();
    if (!looksLikeEmail(address)) continue;
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(address);
  }

  return out;
}

/**
 * Send a transactional email.
 *
 * @param {object} opts
 * @param {string|string[]} opts.to  Recipient address, or several. Multiple
 *   recipients go out as ONE message with one `to` header — Resend bills and
 *   rate-limits per message, not per address, so adding a second recipient
 *   costs nothing against the sending quota. Invalid and duplicate addresses
 *   are dropped; the send is skipped only when none survive.
 * @param {string} opts.subject   Subject line.
 * @param {string} opts.html      HTML body.
 * @param {string} [opts.text]    Plain-text fallback body.
 * @param {string} [opts.from]    Override the default From header.
 * @param {string} [opts.replyTo] Override the default Reply-To header.
 * @param {Array<{filename: string, content: Buffer}>} [opts.attachments]
 * @param {string} [opts.template] Template key recorded in the EmailLog audit trail.
 * @param {string} [opts.orderId]  Order this email is about, for the audit trail.
 * @returns {Promise<{ ok: boolean, provider: string, skipped?: boolean, error?: string }>}
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
  replyTo,
  attachments,
  template = "unknown",
  orderId,
}) {
  const recipients = normaliseRecipients(to);
  if (recipients.length === 0) {
    console.warn(`[email] Skipped: no valid email address (received: ${to ?? "none"})`);
    await recordEmailLog({
      // What was attempted, for the audit trail. Blank/missing entries are
      // dropped so an all-empty list logs "" rather than a row of separators.
      recipient: (Array.isArray(to) ? to : [to]).map((v) => String(v ?? "").trim())
        .filter(Boolean)
        .join(", "),
      subject,
      template,
      provider: "none",
      status: "SKIPPED",
      error: "invalid_email",
      orderId,
    });
    return { ok: false, provider: "none", skipped: true, error: "invalid_email" };
  }

  // The audit trail stores one string per email, so several recipients are
  // recorded as the comma-joined list they were actually sent to.
  const recipient = recipients.join(", ");

  const sender =
    from || process.env.EMAIL_FROM || "Ayurshoppee <onboarding@resend.dev>";
  const replyAddress = replyTo || process.env.EMAIL_REPLY_TO || null;
  const provider = resolveProvider();

  if (provider === "resend") {
    try {
      const result = await sendViaResend({
        from: sender,
        // The array form: Resend puts every address in one message's `to`.
        to: recipients,
        subject,
        html,
        text,
        replyTo: replyAddress,
        attachments,
      });
      await recordEmailLog({
        recipient,
        subject,
        template,
        provider: "resend",
        status: "SENT",
        orderId,
      });
      return result;
    } catch (error) {
      // Never let a messaging failure surface to the caller's critical path.
      // Logged loudly: a hit rate-limit here silently blocks password resets,
      // so this line is what tells you before customers do.
      const message = String(error?.message || error);
      console.error(
        `[email] DELIVERY FAILED provider=resend subject="${subject}" to=${maskForLog(recipient)}: ${message}`
      );
      await recordEmailLog({
        recipient,
        subject,
        template,
        provider: "resend",
        status: "FAILED",
        error: message,
        orderId,
      });
      return { ok: false, provider: "resend", error: message };
    }
  }

  // Console fallback — used in dev or when credentials are not configured.
  console.info(
    `[email:console] -> ${recipient}\n` +
      `             Subject: ${subject}\n` +
      `             ${text || stripHtml(html)}\n` +
      `${attachments?.length ? `             Attachments: ${attachments.map((a) => a.filename).join(", ")}\n` : ""}` +
      `             (set RESEND_API_KEY + EMAIL_FROM to send for real)`
  );
  await recordEmailLog({
    recipient,
    subject,
    template,
    provider: "console",
    status: "SENT",
    orderId,
  });
  return { ok: true, provider: "console" };
}

/**
 * Append one row to the EmailLog audit trail.
 *
 * Best-effort by design: a logging failure must never turn into a failed
 * email, so every error is swallowed here. Bodies are deliberately not stored —
 * they are large, reproducible from the template, and can contain OTP codes.
 */
async function recordEmailLog(entry) {
  try {
    await prisma.emailLog.create({
      data: {
        recipient: entry.recipient.slice(0, 320),
        subject: String(entry.subject ?? "").slice(0, 500),
        template: entry.template || "unknown",
        provider: entry.provider,
        status: entry.status,
        error: entry.error ? String(entry.error).slice(0, 2000) : null,
        orderId: entry.orderId ?? null,
      },
    });
  } catch (error) {
    console.error("[email] could not write EmailLog row:", error?.message || error);
  }
}

/**
 * Resend HTTP API implementation.
 * @returns {Promise<{ ok: boolean, provider: "resend" }>}
 */
async function sendViaResend({ from, to, subject, html, text, replyTo, attachments }) {
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
      // Resend takes attachment bytes as base64 in the JSON body.
      ...(attachments?.length
        ? {
            attachments: attachments.map((file) => ({
              filename: file.filename,
              content: Buffer.from(file.content).toString("base64"),
            })),
          }
        : {}),
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.error) {
    throw new Error(data?.error?.message || data?.message || `Resend responded ${res.status}`);
  }

  return { ok: true, provider: "resend" };
}

/**
 * Keep full addresses out of log aggregators while staying diagnosable.
 * Accepts one address or the comma-joined list of a multi-recipient send, and
 * masks each part so a failure line still shows how many addresses were tried.
 */
function maskForLog(email) {
  return String(email)
    .split(",")
    .map((part) => {
      const [local, domain] = part.trim().split("@");
      if (!local || !domain) return "***";
      return `${local.slice(0, 2)}***@${domain}`;
    })
    .join(", ");
}

/** Crude HTML → text reduction for the plain-text fallback / console logs. */
function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Escape user-supplied values before they go into an HTML template. */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Shared presentation
// ---------------------------------------------------------------------------

const BRAND_COLOR = "#156c6b";

/**
 * Branding + links every template needs, read once from editable site settings.
 * Falls back to sane defaults whenever the DB is unreachable so an email is
 * never blocked by a settings lookup.
 *
 * @returns {Promise<{brand: string, supportEmail: string, siteUrl: string}>}
 */
export async function getBrandContext() {
  let brand = "Ayurshoppee";
  let supportEmail = "support@ayurshoppee.ae";

  try {
    const settings = await getSiteSettings();
    brand = settings.contact_company?.trim() || brand;
    supportEmail = settings.contact_email?.trim() || supportEmail;
  } catch {
    // Settings unavailable — keep the defaults above.
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return { brand, supportEmail, siteUrl };
}

/**
 * The shared HTML shell: branded header, white card, support footer. Every
 * template renders its own `bodyHtml` into it so the chrome only exists once.
 */
export function renderEmailLayout({ brand, supportEmail, bodyHtml }) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:${BRAND_COLOR};padding:28px 32px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:22px;letter-spacing:0.5px;">${escapeHtml(brand)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;">
                Need help? Contact us at <a href="mailto:${escapeHtml(supportEmail)}" style="color:${BRAND_COLOR};">${escapeHtml(supportEmail)}</a>.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** A centred call-to-action button. */
export function renderButton(href, label) {
  return `<p style="margin:0 0 28px;text-align:center;">
  <a href="${escapeHtml(href)}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:8px;">${escapeHtml(label)}</a>
</p>`;
}

/** A highlighted key/value block — order number, tracking status, and so on. */
export function renderInfoRows(rows) {
  const body = rows
    .filter(Boolean)
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:6px 0;font-size:14px;color:#64748b;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;font-size:14px;color:#0f172a;text-align:right;font-weight:bold;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("\n");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:0 0 24px;">
${body}
</table>`;
}

/**
 * Order line items with a totals block.
 *
 * @param {Array<{productName: string, quantity: number, total: any}>} items
 * @param {{subtotal?: any, shipping?: any, total?: any}} [totals]
 */
export function renderItemsTable(items, totals = null) {
  const lines = (items ?? [])
    .map(
      (item) =>
        `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px;">${escapeHtml(item.productName)}<br/><span style="color:#64748b;font-size:13px;">Qty ${escapeHtml(item.quantity)}</span></td>
          <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:right;white-space:nowrap;">${escapeHtml(formatMoney(item.total))}</td>
        </tr>`
    )
    .join("\n");

  const totalRows = totals
    ? [
        totals.subtotal != null ? ["Subtotal", formatMoney(totals.subtotal)] : null,
        totals.shipping != null ? ["Delivery", formatMoney(totals.shipping)] : null,
      ]
        .filter(Boolean)
        .map(
          ([label, value]) =>
            `<tr>
              <td style="padding:4px 0;font-size:14px;color:#64748b;">${escapeHtml(label)}</td>
              <td style="padding:4px 0;font-size:14px;text-align:right;color:#64748b;">${escapeHtml(value)}</td>
            </tr>`
        )
        .join("\n") +
      (totals.total != null
        ? `<tr>
            <td style="padding:10px 0 0;font-size:16px;font-weight:bold;">Total</td>
            <td style="padding:10px 0 0;font-size:16px;font-weight:bold;text-align:right;">${escapeHtml(formatMoney(totals.total))}</td>
          </tr>`
        : "")
    : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
${lines}
${totalRows}
</table>`;
}

/** Plain-text rendering of order lines, for the text/plain alternative. */
export function itemsToText(items) {
  return (items ?? [])
    .map((item) => `  - ${item.productName} x${item.quantity} — ${formatMoney(item.total)}`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Welcome letter
// ---------------------------------------------------------------------------

/**
 * Localised welcome-letter copy. Each entry exposes the dynamic fields as
 * functions so a single template can render any language.
 */
const WELCOME_CONTENT = {
  en: {
    subject: (brand) => `Welcome to ${brand}!`,
    greeting: (name) => `Dear ${name},`,
    intro: (brand) =>
      `Thank you for creating your account with ${brand}. We're delighted to welcome you to our community of wellness seekers.`,
    body: "Your account is ready. You can now explore our authentic Ayurvedic products, track your orders, and manage everything from your personal dashboard.",
    cta: "Start shopping",
    closing: (brand) => `Warm regards,\nThe ${brand} Team`,
  },
  hi: {
    subject: (brand) => `${brand} में आपका स्वागत है!`,
    greeting: (name) => `प्रिय ${name},`,
    intro: (brand) =>
      `${brand} के साथ अपना खाता बनाने के लिए धन्यवाद। हमारे कल्याण समुदाय में आपका स्वागत करते हुए हमें खुशी हो रही है।`,
    body: "आपका खाता तैयार है। अब आप हमारे प्रामाणिक आयुर्वेदिक उत्पादों को देख सकते हैं, अपने ऑर्डर ट्रैक कर सकते हैं और अपने डैशबोर्ड से सब कुछ प्रबंधित कर सकते हैं।",
    cta: "खरीदारी शुरू करें",
    closing: (brand) => `सादर,\n${brand} टीम`,
  },
  ml: {
    subject: (brand) => `${brand}-ലേക്ക് സ്വാഗതം!`,
    greeting: (name) => `പ്രിയ ${name},`,
    intro: (brand) =>
      `${brand}-ൽ അക്കൗണ്ട് സൃഷ്ടിച്ചതിന് നന്ദി. ഞങ്ങളുടെ ആരോഗ്യ സമൂഹത്തിലേക്ക് നിങ്ങളെ സ്വാഗതം ചെയ്യുന്നതിൽ സന്തോഷമുണ്ട്.`,
    body: "നിങ്ങളുടെ അക്കൗണ്ട് തയ്യാറാണ്. ഇപ്പോൾ നിങ്ങൾക്ക് ആധികാരിക ആയുർവേദ ഉൽപ്പന്നങ്ങൾ കാണാം, ഓർഡറുകൾ ട്രാക്ക് ചെയ്യാം, ഡാഷ്‌ബോർഡിൽ നിന്ന് എല്ലാം നിയന്ത്രിക്കാം.",
    cta: "ഷോപ്പിംഗ് ആരംഭിക്കുക",
    closing: (brand) => `സ്നേഹപൂർവ്വം,\n${brand} ടീം`,
  },
};

/**
 * Send the welcome letter email to a newly registered user.
 *
 * Fire-and-forget by design: callers should NOT block the signup response on
 * this. On serverless, wrap the call in `after()` from "next/server" so the
 * runtime doesn't freeze before the send completes.
 *
 * @param {{ name?: string, email?: string|null }} user
 * @param {{ lang?: string }} [options]  Preferred language ("en" | "hi" | "ml").
 * @returns {Promise<void>}
 */
export async function sendWelcomeEmail(user, { lang = "en" } = {}) {
  if (!user?.email) return;

  const firstName = (user.name || "there").trim().split(/\s+/)[0];
  const content = WELCOME_CONTENT[lang] || WELCOME_CONTENT.en;
  const { brand, supportEmail, siteUrl } = await getBrandContext();
  const shopUrl = `${siteUrl}/products`;

  const bodyHtml = `
                <p style="margin:0 0 16px;font-size:16px;font-weight:bold;">${escapeHtml(content.greeting(firstName))}</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(content.intro(brand))}</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${escapeHtml(content.body)}</p>
${renderButton(shopUrl, content.cta)}
                <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(content.closing(brand)).replace(/\n/g, "<br/>")}</p>`;

  const html = renderEmailLayout({ brand, supportEmail, bodyHtml });
  const text = `${content.greeting(firstName)}\n\n${content.intro(brand)}\n\n${content.body}\n\n${content.cta}: ${shopUrl}\n\n${content.closing(brand)}`;

  try {
    await sendEmail({ to: user.email, subject: content.subject(brand), html, text, template: "welcome" });
  } catch (error) {
    console.error("[email] sendWelcomeEmail failed:", error?.message || error);
  }
}

// ---------------------------------------------------------------------------
// Password reset OTP
// ---------------------------------------------------------------------------

/** Localised copy for the password-reset OTP email. */
const RESET_OTP_CONTENT = {
  en: {
    subject: (brand) => `Your ${brand} password reset code`,
    greeting: (name) => `Hi ${name},`,
    intro:
      "We received a request to reset the password for your account. Use the one-time password (OTP) below to continue.",
    label: "Your OTP",
    expiry: (mins) =>
      `This code expires in ${mins} minutes. Do not share it with anyone — our team will never ask you for it.`,
    ignore:
      "If you didn't request a password reset, you can safely ignore this email; your password will stay the same.",
    closing: (brand) => `Regards,\nThe ${brand} Team`,
  },
  hi: {
    subject: (brand) => `आपका ${brand} पासवर्ड रीसेट कोड`,
    greeting: (name) => `नमस्ते ${name},`,
    intro:
      "हमें आपके खाते का पासवर्ड रीसेट करने का अनुरोध मिला है। जारी रखने के लिए नीचे दिया गया वन-टाइम पासवर्ड (OTP) उपयोग करें।",
    label: "आपका OTP",
    expiry: (mins) =>
      `यह कोड ${mins} मिनट में समाप्त हो जाएगा। इसे किसी के साथ साझा न करें — हमारी टीम इसे कभी नहीं मांगेगी।`,
    ignore:
      "यदि आपने पासवर्ड रीसेट का अनुरोध नहीं किया है, तो इस ईमेल को अनदेखा करें; आपका पासवर्ड वही रहेगा।",
    closing: (brand) => `सादर,\n${brand} टीम`,
  },
  ml: {
    subject: (brand) => `നിങ്ങളുടെ ${brand} പാസ്‌വേഡ് റീസെറ്റ് കോഡ്`,
    greeting: (name) => `ഹായ് ${name},`,
    intro:
      "നിങ്ങളുടെ അക്കൗണ്ടിന്റെ പാസ്‌വേഡ് റീസെറ്റ് ചെയ്യാനുള്ള അഭ്യർത്ഥന ഞങ്ങൾക്ക് ലഭിച്ചു. തുടരാൻ താഴെയുള്ള വൺ-ടൈം പാസ്‌വേഡ് (OTP) ഉപയോഗിക്കുക.",
    label: "നിങ്ങളുടെ OTP",
    expiry: (mins) =>
      `ഈ കോഡ് ${mins} മിനിറ്റിനുള്ളിൽ കാലഹരണപ്പെടും. ഇത് ആരുമായും പങ്കിടരുത് — ഞങ്ങളുടെ ടീം ഒരിക്കലും ഇത് ചോദിക്കില്ല.`,
    ignore:
      "നിങ്ങൾ പാസ്‌വേഡ് റീസെറ്റ് അഭ്യർത്ഥിച്ചിട്ടില്ലെങ്കിൽ, ഈ ഇമെയിൽ അവഗണിക്കാം; നിങ്ങളുടെ പാസ്‌വേഡ് അതേപടി തുടരും.",
    closing: (brand) => `സ്നേഹപൂർവ്വം,\n${brand} ടീം`,
  },
};

/**
 * Email a one-time password for the forgot/reset password flow.
 *
 * Unlike the welcome letter this is on the user's critical path, so callers
 * SHOULD await it and surface a failure. It still resolves to the sendEmail
 * result rather than throwing.
 *
 * @param {{ name?: string, email?: string|null }} user
 * @param {string} otp                      The plaintext 6-digit code.
 * @param {{ expiryMinutes?: number, lang?: string }} [options]
 * @returns {Promise<{ ok: boolean, provider: string }>}
 */
export async function sendPasswordResetOtpEmail(user, otp, { expiryMinutes = 10, lang = "en" } = {}) {
  if (!user?.email) return { ok: false, provider: "none" };

  const firstName = (user.name || "there").trim().split(/\s+/)[0];
  const content = RESET_OTP_CONTENT[lang] || RESET_OTP_CONTENT.en;
  const { brand, supportEmail } = await getBrandContext();

  const bodyHtml = `
                <p style="margin:0 0 16px;font-size:16px;font-weight:bold;">${escapeHtml(content.greeting(firstName))}</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${escapeHtml(content.intro)}</p>
                <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-align:center;">${escapeHtml(content.label)}</p>
                <p style="margin:0 0 24px;text-align:center;">
                  <span style="display:inline-block;background:#f0fdfa;border:1px solid #99f6e4;color:#0f766e;font-size:34px;font-weight:bold;letter-spacing:10px;padding:14px 24px;border-radius:10px;">${escapeHtml(otp)}</span>
                </p>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(content.expiry(expiryMinutes))}</p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(content.ignore)}</p>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(content.closing(brand)).replace(/\n/g, "<br/>")}</p>`;

  const html = renderEmailLayout({ brand, supportEmail, bodyHtml });
  const text = `${content.greeting(firstName)}\n\n${content.intro}\n\n${content.label}: ${otp}\n\n${content.expiry(expiryMinutes)}\n\n${content.ignore}\n\n${content.closing(brand)}`;

  return sendEmail({ to: user.email, subject: content.subject(brand), html, text, template: "password_reset_otp" });
}
