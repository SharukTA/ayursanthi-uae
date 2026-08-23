import { prisma } from "@/lib/prisma";
import { hashPassword, revokeSessionsData } from "@/lib/auth";
import { sendSecurityAlertEmail } from "@/lib/email-security";
import { queueEmail } from "@/lib/email-queue";
import { validatePassword } from "@/lib/validation";
import {
  otpMatches,
  findUserByIdentifier,
  findActiveOtp,
  OTP_MAX_ATTEMPTS,
} from "@/lib/reset-otp";
import {
  clientIp,
  consumeRateLimit,
  rateLimitedResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Step 3 (final) of the reset flow: re-verify the OTP, set the new password, and
 * consume the code so it can never be reused. All other unconsumed codes for the
 * user are cleared too.
 *
 * We intentionally do NOT sign the user in here — matching Amazon, they're sent
 * back to the sign-in page to log in with their new password.
 */
export async function POST(request) {
  try {
    // Shares its bucket with verify-reset-otp: both spend guesses against the
    // same 6-digit code, so they must draw on one allowance or an attacker just
    // moves their guessing to whichever endpoint is not counted.
    const limit = await consumeRateLimit({
      key: `otp:ip:${clientIp(request)}`,
      ...RATE_LIMITS.otpAttempt,
    });
    if (!limit.allowed) {
      return rateLimitedResponse(
        limit.retryAfter,
        "Too many attempts. Please wait a few minutes and try again."
      );
    }

    const { identifier, otp, newPassword } = await request.json();

    if (!identifier || !otp || !newPassword) {
      return Response.json(
        { message: "Missing required fields." },
        { status: 400 }
      );
    }

    // Enforce the same password policy as registration.
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return Response.json({ message: passwordError }, { status: 400 });
    }

    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return Response.json(
        { message: "That code is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const record = await findActiveOtp(user.id);
    if (!record || record.attempts >= OTP_MAX_ATTEMPTS) {
      return Response.json(
        { message: "That code is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    if (!otpMatches(String(otp).trim(), record.otpHash)) {
      await prisma.passwordResetOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      return Response.json(
        { message: "That code is incorrect. Please try again." },
        { status: 400 }
      );
    }

    // Valid — update the password and burn every outstanding code for this user.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        // Revoking sessions in the SAME statement as the password write is the
        // point of the reset. A session is a self-contained encrypted cookie, so
        // changing the password alone does nothing to one an attacker already
        // holds — they would keep the account for the remaining days of its life,
        // which is precisely the situation the victim is resetting to escape.
        data: { passwordHash: hashPassword(newPassword), ...revokeSessionsData() },
      }),
      prisma.passwordResetOtp.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      prisma.passwordResetOtp.deleteMany({
        where: { userId: user.id, consumedAt: null },
      }),
    ]);

    // Tell the account owner their password changed. If the reset was not them,
    // this is the only warning they get — and it lands in the inbox rather than
    // the session the attacker controls.
    queueEmail(() => sendSecurityAlertEmail(user, "password_reset"));

    return Response.json({ ok: true, message: "Your password has been reset. Please sign in." });
  } catch (error) {
    console.error("Reset-password error:", error);
    return Response.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
