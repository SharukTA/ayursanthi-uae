import { prisma } from "@/lib/prisma";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { sendSecurityAlertEmail } from "@/lib/email-security";
import { queueEmail } from "@/lib/email-queue";
import { validatePassword } from "@/lib/validation";

export const runtime = "nodejs";

export async function PUT(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
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

  const newHash = hashPassword(newPassword);
  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: newHash },
  });

  queueEmail(() => sendSecurityAlertEmail(user, "password_changed"));

  return Response.json({ message: "Password updated successfully." });
}
