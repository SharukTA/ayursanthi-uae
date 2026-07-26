import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

export async function GET() {
  // Shares the guard used by every /api/admin route, so this endpoint — which
  // returns the whole customer list — also verifies the role against the
  // database rather than trusting the session cookie's claim.
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });

  return Response.json({ users });
}
