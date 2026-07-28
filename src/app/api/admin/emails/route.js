import { prisma } from "@/lib/prisma";
import { prismaErrorResponse, requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

const PAGE_SIZE = 100;
const VALID_STATUSES = ["SENT", "FAILED", "SKIPPED"];

/**
 * GET /api/admin/emails — the transactional email audit trail.
 *
 * Answers "did this customer actually get their refund email?" without digging
 * through server logs. Supports ?status= and ?search= (recipient, subject or
 * template), newest first.
 */
export async function GET(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const status = String(searchParams.get("status") || "").toUpperCase();
    const search = String(searchParams.get("search") || "").trim();

    const where = {
      ...(VALID_STATUSES.includes(status) ? { status } : {}),
      ...(search
        ? {
            OR: [
              { recipient: { contains: search, mode: "insensitive" } },
              { subject: { contains: search, mode: "insensitive" } },
              { template: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [logs, failedCount] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
      }),
      // Surfaced as a banner: a run of failures means the provider is rejecting
      // sends, which silently breaks password resets too.
      prisma.emailLog.count({
        where: {
          status: "FAILED",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return Response.json({ logs, failedLast24h: failedCount });
  } catch (err) {
    return prismaErrorResponse(err, "Unable to load the email log.");
  }
}
