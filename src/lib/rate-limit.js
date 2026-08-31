import { prisma } from "@/lib/prisma";

/**
 * Fixed-window rate limiting, backed by Postgres.
 *
 * Deliberately NOT an in-process Map. Production is serverless (Vercel): every
 * cold start gets its own memory, several instances serve traffic at once, and
 * they are recycled constantly — so an in-memory counter would let an attacker
 * through simply by arriving on a different instance. The database is the only
 * state all instances share.
 *
 * The whole check is ONE statement. Read-then-write would race: a burst of
 * parallel login attempts would all read the same count and all decide they were
 * under the limit. `INSERT … ON CONFLICT DO UPDATE … RETURNING` increments and
 * reports the new value atomically, so concurrent requests are serialised by the
 * row lock and each sees a distinct count.
 */

// Rows are only interesting until their window closes. Rather than run a cron to
// tidy up, each call has a small chance of sweeping expired rows — cheap, and it
// keeps the table proportional to live traffic rather than to all traffic ever.
const SWEEP_PROBABILITY = 0.01;

/**
 * Records one hit against `key` and reports whether it is allowed.
 *
 * FAILS OPEN. If the database is unreachable, the request is permitted and the
 * failure is logged: a rate limiter that is down must not take sign-in down with
 * it. The trade is deliberate — this protects against brute force, not against
 * an attacker who can already knock out our database.
 *
 * @param {object} args
 * @param {string} args.key            Identifies the bucket, e.g. "login:ip:1.2.3.4".
 * @param {number} args.limit          Hits allowed per window.
 * @param {number} args.windowSeconds  Window length.
 * @returns {Promise<{allowed: boolean, remaining: number, retryAfter: number}>}
 *   `retryAfter` is seconds until the window resets (0 when allowed).
 */
export async function consumeRateLimit({ key, limit, windowSeconds }) {
  const expiresAt = new Date(Date.now() + windowSeconds * 1000);

  try {
    const rows = await prisma.$queryRaw`
      INSERT INTO "RateLimit" ("key", "count", "expiresAt")
      VALUES (${key}, 1, ${expiresAt})
      ON CONFLICT ("key") DO UPDATE SET
        -- A window that has already closed is restarted rather than continued,
        -- which is what makes this a fixed window and not a permanent ban.
        "count" = CASE
          WHEN "RateLimit"."expiresAt" <= NOW() THEN 1
          ELSE "RateLimit"."count" + 1
        END,
        "expiresAt" = CASE
          WHEN "RateLimit"."expiresAt" <= NOW() THEN ${expiresAt}
          ELSE "RateLimit"."expiresAt"
        END
      RETURNING "count", "expiresAt"`;

    const row = rows[0];
    const count = Number(row?.count ?? 1);
    const windowEnd = row?.expiresAt ? new Date(row.expiresAt).getTime() : expiresAt.getTime();

    if (Math.random() < SWEEP_PROBABILITY) {
      // Fire and forget: tidying is never worth failing or delaying a request.
      prisma.rateLimit
        .deleteMany({ where: { expiresAt: { lte: new Date() } } })
        .catch(() => {});
    }

    if (count > limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(1, Math.ceil((windowEnd - Date.now()) / 1000)),
      };
    }

    return { allowed: true, remaining: Math.max(0, limit - count), retryAfter: 0 };
  } catch (error) {
    console.error(`[rate-limit] Check failed for "${key}", allowing through:`, error?.message || error);
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }
}

/**
 * Clears a bucket. Call it after a request succeeds, so a legitimate user never
 * accumulates a budget they might later trip over: someone who mistypes their
 * password three times and then gets it right has spent nothing.
 *
 * That only helps the honest case. An attacker guessing wrong never reaches this
 * line, so their counter keeps climbing — which is the whole point.
 */
export async function resetRateLimit(key) {
  try {
    await prisma.rateLimit.deleteMany({ where: { key } });
  } catch (error) {
    // Nothing here is worth failing a request that has already succeeded; the
    // window closes by itself soon enough.
    console.error(`[rate-limit] Could not reset "${key}":`, error?.message || error);
  }
}

/**
 * The caller's IP address.
 *
 * On Vercel the client address only exists in `x-forwarded-for`, whose LAST
 * entries are appended by the platform and whose first entries are whatever the
 * client claimed. Vercel overwrites the header rather than appending to it, so
 * the first entry is the real client — but on any host that appends, trusting
 * the first entry lets an attacker rotate their own bucket at will by sending a
 * fake one. `x-real-ip` is preferred where present because it is single-valued
 * and set by the proxy itself.
 *
 * Returns "unknown" when nothing is available, which simply buckets those
 * callers together — a shared bucket is a stricter limit, never a looser one.
 */
export function clientIp(request) {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

/**
 * The 429 every limited route returns. `Retry-After` is a standard response
 * header, so well-behaved clients (and Stripe-style retriers) back off on their
 * own instead of hammering.
 */
export function rateLimitedResponse(retryAfter, message) {
  return Response.json(
    {
      message:
        message || "Too many attempts. Please wait a moment and try again.",
      retryAfter,
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

// ── Bucket definitions ──────────────────────────────────────────────────────
//
// Kept together so the whole policy can be read at a glance. Limits are set to
// be invisible to a real person (nobody types their password wrong 10 times in
// 15 minutes) while making an online guessing attack useless.
export const RATE_LIMITS = {
  // Per-IP: the blunt instrument that stops one host spraying many accounts.
  loginByIp: { limit: 20, windowSeconds: 15 * 60 },
  // Per-account: stops a distributed attack concentrating on one inbox. Keyed by
  // what was typed, lowercased, so it cannot be sidestepped by changing case.
  loginByIdentifier: { limit: 8, windowSeconds: 15 * 60 },
  // Signup is expensive for us (a welcome email each) and has no legitimate
  // repeat use from one address.
  register: { limit: 6, windowSeconds: 60 * 60 },
  // The tightest of the lot: every call here can send an email, and the Resend
  // free tier is a shared, exhaustible resource. The 30-second per-account
  // throttle in the route is about resends; this is about the volume one host
  // can generate across many accounts.
  forgotPassword: { limit: 5, windowSeconds: 60 * 60 },
  // The OTP row already caps wrong guesses at 5 per code. This stops someone
  // cycling fresh codes, and covers both verify and reset.
  otpAttempt: { limit: 30, windowSeconds: 15 * 60 },
  // Changing a password requires the current one, so this is brute-force cover
  // for an attacker who has a session but not the password.
  passwordChange: { limit: 10, windowSeconds: 15 * 60 },
  // Starting an online payment reserves stock, writes an order row and opens a
  // Stripe Checkout Session, so every call costs a round trip to Stripe and a
  // little order churn. Set well clear of real use: a shopper whose card keeps
  // being declined, or who bounces off Stripe's page and edits the basket a few
  // times, can genuinely start half a dozen checkouts in one sitting and must
  // never meet this. What it stops is a script opening them in a loop.
  checkoutStart: { limit: 12, windowSeconds: 10 * 60 },
  // Cart writes. Nothing in the cart UI debounces — every +/- click and every
  // tick is its own request — so this is a backstop against a script, not a
  // control on shopping, and is set where no amount of real clicking reaches it.
  // The window is one minute rather than something longer on purpose: a shopper
  // who does go at it gets a clean slate every minute instead of accumulating a
  // lockout across a browsing session.
  cartWrite: { limit: 120, windowSeconds: 60 },
  // Posting a review is already gated to verified buyers and upserts one row per
  // user per product, so there is nothing to flood — this only stops the same
  // row being rewritten in a loop. Generous enough for somebody working through
  // everything they have bought in one sitting.
  reviewPost: { limit: 10, windowSeconds: 60 * 60 },
};
