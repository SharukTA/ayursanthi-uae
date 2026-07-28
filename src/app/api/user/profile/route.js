import { prisma } from "@/lib/prisma";
import { getSession, setSession } from "@/lib/auth";
import { sendSecurityAlertEmail } from "@/lib/email-security";
import { queueEmail } from "@/lib/email-queue";
import { validateName, validatePhone, normalizePhone } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      _count: { select: { orders: true } },
      createdAt: true,
    },
  });

  if (!user) {
    return Response.json({ message: "User not found" }, { status: 404 });
  }

  return Response.json({ user });
}

export async function PUT(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, phone } = body;

  // Mirror the registration rules so the profile edit can't be used to store a
  // name/phone the sign-up form would have rejected. Phone is optional here.
  const nameError = validateName(name);
  if (nameError) {
    return Response.json({ message: nameError, errors: { name: nameError } }, { status: 400 });
  }

  const phoneError = validatePhone(phone);
  if (phoneError) {
    return Response.json({ message: phoneError, errors: { phone: phoneError } }, { status: 400 });
  }

  // Store the normalised international form so it matches how registration
  // saves phones — otherwise the duplicate check below and login-by-phone miss.
  const cleanPhone = phone && phone.trim() ? normalizePhone(phone) : null;

  if (cleanPhone) {
    const existing = await prisma.user.findFirst({
      where: { phone: cleanPhone, NOT: { id: session.userId } },
    });
    if (existing) {
      const message = "This phone number is already in use.";
      return Response.json({ message, errors: { phone: message } }, { status: 400 });
    }
  }

  // Read the current values first so the security alert can say what actually
  // changed — and so re-saving an unchanged form doesn't email the customer.
  const before = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, phone: true },
  });

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { name: name.trim(), phone: cleanPhone },
    select: { id: true, name: true, email: true, phone: true },
  });

  await setSession({ ...session, name: user.name });

  const changes = [];
  if (before && before.name !== user.name) {
    changes.push(["Name", `${before.name} → ${user.name}`]);
  }
  if (before && (before.phone ?? null) !== (user.phone ?? null)) {
    changes.push(["Phone", `${before.phone || "not set"} → ${user.phone || "removed"}`]);
  }
  if (changes.length > 0) {
    queueEmail(() => sendSecurityAlertEmail(user, "profile_changed", { changes }));
  }

  return Response.json({ user, message: "Profile updated successfully." });
}
