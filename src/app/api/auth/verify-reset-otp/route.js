import { prisma } from "@/lib/prisma";
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
 * Step 2 of the reset flow: verify the OTP the user typed WITHOUT consuming it.
 * This lets the UI show a dedicated "enter code" screen (Amazon-style) before
 * asking for the new password; the code is only burned in step 3
 * (reset-password), which re-verifies it.
 *
 * Wrong guesses increment the attempt counter; once it reaches the cap the code
 * is deleted and the user must request a new one.
 */
export async function POST(request) {
  try {
    // The 5-attempt cap on the OTP row is per code. This is per host, and closes
    // the gap that cap leaves: burn five guesses, request a fresh code, repeat.
    // A 6-digit code is only safe while the number of guesses stays small.
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

    const { identifier, otp } = await request.json();

    if (!identifier || !otp) {
      return Response.json(
        { message: "Please enter the code we sent you." },
        { status: 400 }
      );
    }

    const invalid = {
      message: "That code is invalid or has expired. Please check and try again.",
    };

    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return Response.json(invalid, { status: 400 });
    }

    const record = await findActiveOtp(user.id);
    if (!record) {
      return Response.json(invalid, { status: 400 });
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.passwordResetOtp.delete({ where: { id: record.id } });
      return Response.json(
        { message: "Too many incorrect attempts. Please request a new code." },
        { status: 429 }
      );
    }

    if (!otpMatches(String(otp).trim(), record.otpHash)) {
      const updated = await prisma.passwordResetOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      const remaining = Math.max(0, OTP_MAX_ATTEMPTS - updated.attempts);
      return Response.json(
        {
          message:
            remaining > 0
              ? `That code is incorrect. You have ${remaining} attempt${remaining === 1 ? "" : "s"} left.`
              : "Too many incorrect attempts. Please request a new code.",
        },
        { status: 400 }
      );
    }

    return Response.json({ ok: true, verified: true });
  } catch (error) {
    console.error("Verify-reset-otp error:", error);
    return Response.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
