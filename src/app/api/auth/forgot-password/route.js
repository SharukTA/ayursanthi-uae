import { prisma } from "@/lib/prisma";
import { sendPasswordResetOtpEmail } from "@/lib/email";
import {
  generateOtp,
  hashOtp,
  findUserByIdentifier,
  findActiveOtp,
  maskEmail,
  OTP_EXPIRY_MINUTES,
  OTP_RESEND_THROTTLE_SECONDS,
} from "@/lib/reset-otp";
import {
  clientIp,
  consumeRateLimit,
  rateLimitedResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Step 1 of the reset flow: the user submits their account email and we email a
 * one-time password.
 *
 * findUserByIdentifier() still resolves a mobile number too, but the UI asks for
 * an email only — there is no SMS sender wired up, so the code can only ever be
 * delivered by email.
 *
 * Deliberately enumeration-safe: the response is the SAME whether or not an
 * account exists, so this endpoint can't be used to probe which emails are
 * registered. A masked destination hint is only included when we actually sent
 * a code (and even then it doesn't confirm the exact address).
 */
export async function POST(request) {
  try {
    // The per-account resend throttle further down stops one inbox being spammed
    // with codes. This is the other half: a cap on how many codes ONE HOST can
    // cause to be sent at all, across however many different accounts it names.
    // Without it a script can walk a list of addresses and burn the whole Resend
    // allowance — which would take the OTP emails down with it, since they share
    // the quota.
    //
    // Checked before the body is even read, and answered with a plain 429. That
    // is not an enumeration leak: the response is identical whether or not the
    // named account exists, exactly like the generic success below.
    const limit = await consumeRateLimit({
      key: `forgot:ip:${clientIp(request)}`,
      ...RATE_LIMITS.forgotPassword,
    });
    if (!limit.allowed) {
      return rateLimitedResponse(
        limit.retryAfter,
        "Too many password reset requests. Please wait a while and try again."
      );
    }

    const { identifier } = await request.json();

    if (!identifier || !String(identifier).trim()) {
      return Response.json(
        { message: "Please enter your email address." },
        { status: 400 }
      );
    }

    const genericOk = {
      message:
        "If an account matches that email address, we've sent a one-time password to it.",
    };

    const user = await findUserByIdentifier(identifier);

    // No account — return the generic success without doing anything.
    if (!user || !user.email) {
      return Response.json(genericOk);
    }

    // Throttle resends: if a live code was issued very recently, don't send
    // another. We still return success so timing can't reveal account state.
    const active = await findActiveOtp(user.id);
    if (active) {
      const ageSeconds = (Date.now() - new Date(active.createdAt).getTime()) / 1000;
      if (ageSeconds < OTP_RESEND_THROTTLE_SECONDS) {
        return Response.json({ ...genericOk, maskedEmail: maskEmail(user.email) });
      }
    }

    // Invalidate any earlier codes for this user, then mint a fresh one.
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.$transaction([
      prisma.passwordResetOtp.deleteMany({ where: { userId: user.id, consumedAt: null } }),
      prisma.passwordResetOtp.create({
        data: { userId: user.id, otpHash: hashOtp(otp), expiresAt },
      }),
    ]);

    // Awaited (unlike the welcome email) because delivery is on the user's
    // critical path — but a provider hiccup shouldn't leak account existence,
    // so we still return the generic success.
    try {
      await sendPasswordResetOtpEmail(user, otp, { expiryMinutes: OTP_EXPIRY_MINUTES });
    } catch (error) {
      console.error("[forgot-password] OTP email failed:", error?.message || error);
    }

    return Response.json({ ...genericOk, maskedEmail: maskEmail(user.email) });
  } catch (error) {
    console.error("Forgot-password error:", error);
    return Response.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
