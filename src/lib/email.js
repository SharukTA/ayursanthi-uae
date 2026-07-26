/**
 * Email module — provider-agnostic transactional email sender.
 *
 * Configured entirely through environment variables and HTTP (no SMTP library /
 * extra dependency), so the app stays portable and works out-of-the-box in
 * development.
 *
 *   EMAIL_PROVIDER   "resend" (default) | "console"
 *   EMAIL_FROM       From header, e.g. "Ayursanthi <welcome@ayursanthi.com>"
 *   RESEND_API_KEY   Resend account API key (https://resend.com)
 *
 * If the required credentials are missing, the module falls back to a console
 * "sender" that logs the message instead of throwing. Signup therefore works
 * immediately in dev and goes live the moment real credentials are added — no
 * code changes required.
 */

import { getSiteSettings } from "@/lib/settings";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

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
 * Send a transactional email.
 *
 * @param {object} opts
 * @param {string} opts.to        Recipient email address.
 * @param {string} opts.subject   Subject line.
 * @param {string} opts.html      HTML body.
 * @param {string} [opts.text]    Plain-text fallback body.
 * @param {string} [opts.from]    Override the default From header.
 * @returns {Promise<{ ok: boolean, provider: string, skipped?: boolean, error?: string }>}
 */
export async function sendEmail({ to, subject, html, text, from }) {
  const recipient = String(to || "").trim();
  if (!looksLikeEmail(recipient)) {
    console.warn(`[email] Skipped: no valid email address (received: ${to ?? "none"})`);
    return { ok: false, provider: "none", skipped: true, error: "invalid_email" };
  }

  const sender =
    from || process.env.EMAIL_FROM || "Ayursanthi <onboarding@resend.dev>";
  const provider = resolveProvider();

  if (provider === "resend") {
    try {
      return await sendViaResend({ from: sender, to: recipient, subject, html, text });
    } catch (error) {
      // Never let a messaging failure surface to the caller's critical path.
      console.error("[email] Resend send failed:", error?.message || error);
      return { ok: false, provider: "resend", error: String(error?.message || error) };
    }
  }

  // Console fallback — used in dev or when credentials are not configured.
  console.info(
    `[email:console] -> ${recipient}\n` +
      `             Subject: ${subject}\n` +
      `             ${text || stripHtml(html)}\n` +
      `             (set RESEND_API_KEY + EMAIL_FROM to send for real)`
  );
  return { ok: true, provider: "console" };
}

/**
 * Resend HTTP API implementation.
 * @returns {Promise<{ ok: boolean, provider: "resend" }>}
 */
async function sendViaResend({ from, to, subject, html, text }) {
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.error) {
    throw new Error(data?.error?.message || data?.message || `Resend responded ${res.status}`);
  }

  return { ok: true, provider: "resend" };
}

/** Crude HTML → text reduction for the plain-text fallback / console logs. */
function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Localised welcome-letter copy. The platform serves an Ayurvedic store based
 * in Kerala, so English, Hindi and Malayalam are provided; unknown languages
 * fall back to English. Each entry exposes the dynamic fields as functions so a
 * single template can render any language.
 */
const WELCOME_CONTENT = {
  en: {
    subject: (brand) => `Welcome to ${brand}!`,
    greeting: (name) => `Dear ${name},`,
    intro: (brand) =>
      `Thank you for creating your account with ${brand}. We're delighted to welcome you to our community of wellness seekers.`,
    body: "Your account is ready. You can now explore our authentic Ayurvedic products, track your orders, earn rewards, and manage everything from your personal dashboard.",
    cta: "Start shopping",
    closing: (brand) => `Warm regards,\nThe ${brand} Team`,
  },
  hi: {
    subject: (brand) => `${brand} में आपका स्वागत है!`,
    greeting: (name) => `प्रिय ${name},`,
    intro: (brand) =>
      `${brand} के साथ अपना खाता बनाने के लिए धन्यवाद। हमारे कल्याण समुदाय में आपका स्वागत करते हुए हमें खुशी हो रही है।`,
    body: "आपका खाता तैयार है। अब आप हमारे प्रामाणिक आयुर्वेदिक उत्पादों को देख सकते हैं, अपने ऑर्डर ट्रैक कर सकते हैं, रिवॉर्ड कमा सकते हैं और अपने डैशबोर्ड से सब कुछ प्रबंधित कर सकते हैं।",
    cta: "खरीदारी शुरू करें",
    closing: (brand) => `सादर,\n${brand} टीम`,
  },
  ml: {
    subject: (brand) => `${brand}-ലേക്ക് സ്വാഗതം!`,
    greeting: (name) => `പ്രിയ ${name},`,
    intro: (brand) =>
      `${brand}-ൽ അക്കൗണ്ട് സൃഷ്ടിച്ചതിന് നന്ദി. ഞങ്ങളുടെ ആരോഗ്യ സമൂഹത്തിലേക്ക് നിങ്ങളെ സ്വാഗതം ചെയ്യുന്നതിൽ സന്തോഷമുണ്ട്.`,
    body: "നിങ്ങളുടെ അക്കൗണ്ട് തയ്യാറാണ്. ഇപ്പോൾ നിങ്ങൾക്ക് ആധികാരിക ആയുർവേദ ഉൽപ്പന്നങ്ങൾ കാണാം, ഓർഡറുകൾ ട്രാക്ക് ചെയ്യാം, റിവാർഡുകൾ നേടാം, ഡാഷ്‌ബോർഡിൽ നിന്ന് എല്ലാം നിയന്ത്രിക്കാം.",
    cta: "ഷോപ്പിംഗ് ആരംഭിക്കുക",
    closing: (brand) => `സ്നേഹപൂർവ്വം,\n${brand} ടീം`,
  },
};

/** Build the branded HTML welcome letter. */
function renderWelcomeHtml({ content, brand, name, supportEmail, shopUrl }) {
  const closingHtml = content.closing(brand).replace(/\n/g, "<br/>");
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:#156c6b;padding:28px 32px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:22px;letter-spacing:0.5px;">${brand}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:16px;font-weight:bold;">${content.greeting(name)}</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${content.intro(brand)}</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${content.body}</p>
                <p style="margin:0 0 28px;text-align:center;">
                  <a href="${shopUrl}" style="display:inline-block;background:#156c6b;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:8px;">${content.cta}</a>
                </p>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${closingHtml}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;">
                Need help? Contact us at <a href="mailto:${supportEmail}" style="color:#156c6b;">${supportEmail}</a>.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Send the welcome letter email to a newly registered user.
 *
 * Fire-and-forget by design: callers should NOT await this on the critical
 * signup path. Any failure is swallowed and logged here.
 *
 * @param {{ name?: string, email?: string|null }} user
 * @param {{ lang?: string }} [options]  Preferred language ("en" | "hi" | "ml").
 * @returns {Promise<void>}
 */
export async function sendWelcomeEmail(user, { lang = "en" } = {}) {
  if (!user?.email) return;

  const firstName = (user.name || "there").trim().split(/\s+/)[0];
  const content = WELCOME_CONTENT[lang] || WELCOME_CONTENT.en;

  // Branding from editable site settings, with sensible fallbacks.
  let brand = "Ayursanthi";
  let supportEmail = "support@ayursanthi.com";
  try {
    const settings = await getSiteSettings();
    brand = settings.contact_company?.trim() || brand;
    supportEmail = settings.contact_email?.trim() || supportEmail;
  } catch {
    // Settings unavailable — keep the defaults above.
  }

  const shopUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")}/products`;
  const html = renderWelcomeHtml({ content, brand, name: firstName, supportEmail, shopUrl });
  const text = `${content.greeting(firstName)}\n\n${content.intro(brand)}\n\n${content.body}\n\n${content.cta}: ${shopUrl}\n\n${content.closing(brand)}`;

  try {
    await sendEmail({
      to: user.email,
      subject: content.subject(brand),
      html,
      text,
    });
  } catch (error) {
    console.error("[email] sendWelcomeEmail failed:", error?.message || error);
  }
}

/**
 * Localised copy for the password-reset OTP email. Same three languages as the
 * welcome letter; unknown languages fall back to English.
 */
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

/** Build the branded HTML OTP email. */
function renderResetOtpHtml({ content, brand, name, otp, expiryMinutes, supportEmail }) {
  const closingHtml = content.closing(brand).replace(/\n/g, "<br/>");
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:#156c6b;padding:28px 32px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:22px;letter-spacing:0.5px;">${brand}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:16px;font-weight:bold;">${content.greeting(name)}</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${content.intro}</p>
                <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-align:center;">${content.label}</p>
                <p style="margin:0 0 24px;text-align:center;">
                  <span style="display:inline-block;background:#f0fdfa;border:1px solid #99f6e4;color:#0f766e;font-size:34px;font-weight:bold;letter-spacing:10px;padding:14px 24px;border-radius:10px;">${otp}</span>
                </p>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">${content.expiry(expiryMinutes)}</p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#334155;">${content.ignore}</p>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${closingHtml}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;">
                Need help? Contact us at <a href="mailto:${supportEmail}" style="color:#156c6b;">${supportEmail}</a>.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

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

  let brand = "Ayursanthi";
  let supportEmail = "support@ayursanthi.com";
  try {
    const settings = await getSiteSettings();
    brand = settings.contact_company?.trim() || brand;
    supportEmail = settings.contact_email?.trim() || supportEmail;
  } catch {
    // Settings unavailable — keep the defaults above.
  }

  const html = renderResetOtpHtml({ content, brand, name: firstName, otp, expiryMinutes, supportEmail });
  const text = `${content.greeting(firstName)}\n\n${content.intro}\n\n${content.label}: ${otp}\n\n${content.expiry(expiryMinutes)}\n\n${content.ignore}\n\n${content.closing(brand)}`;

  return sendEmail({
    to: user.email,
    subject: content.subject(brand),
    html,
    text,
  });
}
