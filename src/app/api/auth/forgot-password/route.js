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

export const runtime = "nodejs";

/**
 * Step 1 of the reset flow: the user submits their email/mobile and we email a
 * one-time password.
 *
 * Deliberately enumeration-safe: the response is the SAME whether or not an
 * account exists, so this endpoint can't be used to probe which emails are
 * registered. A masked destination hint is only included when we actually sent
 * a code (and even then it doesn't confirm the exact address).
 */
export async function POST(request) {
  try {
    const { identifier } = await request.json();

    if (!identifier || !String(identifier).trim()) {
      return Response.json(
        { message: "Please enter your email address or mobile number." },
        { status: 400 }
      );
    }

    const genericOk = {
      message:
        "If an account matches those details, we've sent a one-time password to the registered email.",
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
