import { prisma } from "@/lib/prisma";
import { verifyPassword, setSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return Response.json(
        { message: "Login ID and password are required fields." },
        { status: 400 }
      );
    }

    const cleanIdentifier = identifier.trim();

    // Look up the user by email or phone (email is matched case-insensitively)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanIdentifier.toLowerCase() },
          { phone: cleanIdentifier },
        ],
      },
    });

    if (!user) {
      return Response.json(
        { message: "Invalid login ID or password." },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordCorrect = verifyPassword(password, user.passwordHash);
    if (!isPasswordCorrect) {
      return Response.json(
        { message: "Invalid login ID or password." },
        { status: 401 }
      );
    }

    // Set user session cookie
    await setSession({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    // Strip password hash before returning user details
    const { passwordHash, ...safeUser } = user;

    return Response.json({
      message: "Login successful",
      user: safeUser,
    });
  } catch (error) {
    console.error("Login error:", error);
    return Response.json(
      { message: "Internal server error during login." },
      { status: 500 }
    );
  }
}
