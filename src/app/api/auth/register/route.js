import { prisma } from "@/lib/prisma";
import { hashPassword, setSession } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";
import { validateRegistration, normalizePhone } from "@/lib/validation";

export const runtime = "nodejs";

function generateReferralCode(name) {
  const prefix = String(name || "USR")
    .replace(/[^a-zA-Z]/g, "")
    .substring(0, 4)
    .toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${randomSuffix}`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone, password, referralId } = body;

    // Validation — mirrors the client-side checks so the API can't be bypassed.
    const errors = validateRegistration({ name, email, phone, password });
    if (Object.keys(errors).length > 0) {
      return Response.json(
        { message: Object.values(errors)[0], errors },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone && phone.trim() ? normalizePhone(phone) : null;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanEmail },
          ...(cleanPhone ? [{ phone: cleanPhone }] : []),
        ],
      },
    });

    if (existingUser) {
      const isEmail = existingUser.email === cleanEmail;
      const field = isEmail ? "email" : "phone";
      const label = isEmail ? "email" : "phone number";
      const message = `A user with this ${label} is already registered.`;
      return Response.json({ message, errors: { [field]: message } }, { status: 400 });
    }

    // Handle referral if provided
    let referredById = null;
    if (referralId) {
      const referrer = await prisma.user.findFirst({
        where: {
          OR: [
            { referralCode: referralId.trim() },
            { id: referralId.trim() },
          ],
        },
      });

      if (!referrer) {
        return Response.json(
          { message: "Invalid referral code or referrer not found." },
          { status: 400 }
        );
      }
      referredById = referrer.id;
    }

    // Generate referral code and ensure uniqueness (simple check)
    let referralCode = generateReferralCode(name);
    let codeExists = await prisma.user.findUnique({ where: { referralCode } });
    while (codeExists) {
      referralCode = generateReferralCode(name);
      codeExists = await prisma.user.findUnique({ where: { referralCode } });
    }

    // Hash password
    const passwordHash = hashPassword(password);

    // Create user and wallet in transaction
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        passwordHash,
        referralCode,
        referredById,
        role: "CUSTOMER", // default
        wallet: {
          create: {
            balance: 0.0,
            pendingBalance: 0.0,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        referralCode: true,
        createdAt: true,
      },
    });

    // Set the session cookie
    await setSession({
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });

    // Fire-and-forget welcome email. Intentionally NOT awaited so a messaging
    // failure or slow gateway can never block or break the signup response.
    sendWelcomeEmail({ name: newUser.name, email: newUser.email });

    return Response.json(
      {
        message: "Registration successful",
        user: newUser,
        // Signals the client to confirm the welcome letter via a snackbar.
        welcomeEmailSent: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return Response.json(
      { message: "Internal server error during registration." },
      { status: 500 }
    );
  }
}
