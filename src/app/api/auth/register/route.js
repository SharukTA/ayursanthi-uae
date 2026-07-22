import { prisma } from "@/lib/prisma";
import { hashPassword, setSession } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";
import { validateRegistration, normalizePhone } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone, password } = body;

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

    // Hash password
    const passwordHash = hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        passwordHash,
        role: "CUSTOMER", // default
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
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
