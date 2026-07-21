/**
 * SMS module — provider-agnostic transactional SMS sender.
 *
 * Configured entirely through environment variables so the app stays
 * portable across providers and environments:
 *
 *   SMS_PROVIDER          "msg91" (default) | "console"
 *   SMS_SENDER_ID         DLT-approved 6-char sender/header (e.g. "AYURSN")
 *   MSG91_AUTH_KEY        MSG91 account auth key
 *   MSG91_WELCOME_FLOW_ID DLT-approved Flow/template id for the welcome SMS
 *
 * If the required credentials are missing, the module automatically falls
 * back to a console "sender" that logs the message instead of throwing.
 * This means signup works out-of-the-box in development, and goes live the
 * moment real credentials are added — no code changes required.
 *
 * In India, transactional SMS must use a DLT-registered template. MSG91's
 * Flow API sends a pre-approved template and fills in named variables, so
 * `sendSms` accepts `variables` rather than raw message text for that path.
 * The composed `message` string is still used for logging / the console
 * fallback and for providers that accept free-form text.
 */

const MSG91_FLOW_ENDPOINT = "https://control.msg91.com/api/v5/flow/";

/**
 * Normalise an Indian mobile number to the digits-with-country-code form
 * MSG91 expects (e.g. "919876543210"). Returns null if it doesn't look
 * like a valid 10-digit Indian mobile (optionally already prefixed with 91).
 *
 * @param {string} phone
 * @returns {string|null}
 */
export function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return null;
}

/**
 * Resolve which provider to use. Falls back to "console" whenever the
 * MSG91 credentials needed for a real send are absent.
 *
 * @returns {"msg91" | "console"}
 */
function resolveProvider() {
  const provider = (process.env.SMS_PROVIDER || "msg91").toLowerCase();
  if (provider === "msg91" && process.env.MSG91_AUTH_KEY) return "msg91";
  return "console";
}

/**
 * Send a transactional SMS.
 *
 * @param {object} opts
 * @param {string} opts.to                 Recipient phone number (any common format).
 * @param {string} opts.message            Human-readable message (used for logging / console fallback).
 * @param {string} [opts.flowId]           MSG91 Flow/template id (overrides per-template default).
 * @param {Object<string,string>} [opts.variables]  Template variables for the DLT Flow.
 * @returns {Promise<{ ok: boolean, provider: string, skipped?: boolean, error?: string }>}
 */
export async function sendSms({ to, message, flowId, variables = {} }) {
  const recipient = normalizePhone(to);
  if (!recipient) {
    // No usable number — nothing to send. Not an error the caller should act on.
    console.warn(`[sms] Skipped: no valid phone number (received: ${to ?? "none"})`);
    return { ok: false, provider: "none", skipped: true, error: "invalid_phone" };
  }

  const provider = resolveProvider();

  if (provider === "msg91") {
    try {
      return await sendViaMsg91({ recipient, flowId, variables });
    } catch (error) {
      // Never let a messaging failure surface to the caller's critical path.
      console.error("[sms] MSG91 send failed:", error?.message || error);
      return { ok: false, provider: "msg91", error: String(error?.message || error) };
    }
  }

  // Console fallback — used in dev or when credentials are not configured.
  console.info(
    `[sms:console] -> ${recipient}\n` +
      `           ${message}\n` +
      `           (set MSG91_AUTH_KEY + MSG91_WELCOME_FLOW_ID to send for real)`
  );
  return { ok: true, provider: "console" };
}

/**
 * MSG91 Flow API implementation. Sends a DLT-approved template, filling in
 * the provided named variables for the given recipient.
 *
 * @param {object} opts
 * @param {string} opts.recipient
 * @param {string} [opts.flowId]
 * @param {Object<string,string>} opts.variables
 */
async function sendViaMsg91({ recipient, flowId, variables }) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = flowId || process.env.MSG91_WELCOME_FLOW_ID;
  const senderId = process.env.SMS_SENDER_ID;

  if (!templateId) {
    throw new Error("Missing MSG91 flow/template id");
  }

  const payload = {
    template_id: templateId,
    short_url: "0",
    recipients: [{ mobiles: recipient, ...variables }],
  };
  if (senderId) payload.sender = senderId;

  const res = await fetch(MSG91_FLOW_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authkey: authKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  // MSG91 returns { type: "success", ... } on success.
  if (!res.ok || data?.type === "error") {
    throw new Error(data?.message || `MSG91 responded ${res.status}`);
  }

  return { ok: true, provider: "msg91" };
}

/**
 * Send the welcome SMS to a newly registered user.
 *
 * Fire-and-forget by design: callers should NOT await this on the critical
 * signup path. Any failure is swallowed and logged here.
 *
 * @param {{ name?: string, phone?: string|null }} user
 * @returns {Promise<void>}
 */
export async function sendWelcomeSms(user) {
  if (!user?.phone) return; // phone is optional at registration

  const firstName = (user.name || "there").trim().split(/\s+/)[0];
  const message = `Hi ${firstName}, welcome to Ayursanthi! Your account is ready. Start shopping authentic Ayurvedic products and earn rewards. - Team Ayursanthi`;

  try {
    await sendSms({
      to: user.phone,
      message,
      flowId: process.env.MSG91_WELCOME_FLOW_ID,
      // Variable names must match the placeholders in your DLT template.
      variables: { name: firstName },
    });
  } catch (error) {
    console.error("[sms] sendWelcomeSms failed:", error?.message || error);
  }
}
