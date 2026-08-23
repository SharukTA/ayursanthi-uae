import { prisma } from "@/lib/prisma";
import {
  getSession,
  hashPassword,
  revokeSessionsData,
  setSession,
  verifyPassword,
} from "@/lib/auth";
import { sendSecurityAlertEmail } from "@/lib/email-security";
import { queueEmail } from "@/lib/email-queue";
import { validatePassword } from "@/lib/validation";
import {
  clientIp,
  consumeRateLimit,
  rateLimitedResponse,
  resetRateLimit,
  RATE_LIMITS,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function PUT(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  // This endpoint checks the CURRENT password, so it is a password oracle for
  // anyone who has got hold of a session but not the password itself. Keyed by
  // account rather than by IP: the session already names the account, and the
  // attacker's address is the part they can change most easily.
  const limitKey = `pwchange:user:${session.userId}`;
  const limit = await consumeRateLimit({ key: limitKey, ...RATE_LIMITS.passwordChange });
  if (!limit.allowed) {
    return rateLimitedResponse(
      limit.retryAfter,
      "Too many attempts. Please wait a few minutes and try again."
    );
  }

  const body = await request.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return Response.json(
      { message: "Both current and new password are required." },
      { status: 400 }
    );
  }

  // The shared rule, not a local one: changing a password must not be a way to
  // land on something weaker than register or reset would have allowed.
  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return Response.json({ message: passwordError }, { status: 400 });
  }

  // name/email are read here purely so the security alert below can be sent
  // without a second round-trip.
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { passwordHash: true, name: true, email: true },
  });

  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return Response.json({ message: "Current password is incorrect." }, { status: 400 });
  }

  await resetRateLimit(limitKey);

  const newHash = hashPassword(newPassword);
  await prisma.user.update({
    where: { id: session.userId },
    // Every session issued so far is revoked, not just this one. Someone
    // changing their password because they think an account is compromised
    // expects exactly that — and it is useless if the attacker's cookie, which
    // is self-contained and knows nothing about the new password, survives it.
    data: { passwordHash: newHash, ...revokeSessionsData() },
  });

  // …including the cookie in the hand of the person who just did this, so they
  // are handed a fresh one. Without this they would be signed out by their own
  // password change, which reads as the change having gone wrong. Issued after
  // the write, so its `iat` is necessarily past the new cut-off.
  await setSession({
    userId: session.userId,
    name: user.name,
    email: user.email,
    role: session.role,
  });

  queueEmail(() => sendSecurityAlertEmail(user, "password_changed"));

  return Response.json({
    message: "Password updated successfully. Any other devices have been signed out.",
  });
}
