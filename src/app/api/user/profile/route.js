import { prisma } from "@/lib/prisma";
import { getSession, setSession } from "@/lib/auth";

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

  if (!name?.trim()) {
    return Response.json({ message: "Name is required." }, { status: 400 });
  }

  const cleanPhone = phone ? phone.trim() || null : null;

  if (cleanPhone) {
    const existing = await prisma.user.findFirst({
      where: { phone: cleanPhone, NOT: { id: session.userId } },
    });
    if (existing) {
      return Response.json({ message: "This phone number is already in use." }, { status: 400 });
    }
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { name: name.trim(), phone: cleanPhone },
    select: { id: true, name: true, email: true, phone: true },
  });

  await setSession({ ...session, name: user.name });

  return Response.json({ user, message: "Profile updated successfully." });
}
