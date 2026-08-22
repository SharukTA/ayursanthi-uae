import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canHaveAffiliateId, ensureReferralCode } from "@/lib/referral";

export const runtime = "nodejs";

/**
 * Partially mask an email for display back to the referrer.
 *
 * The referrer needs enough to tell two people named "Ahmed" apart, but they
 * are not entitled to a contactable address for someone who merely used their
 * code — so the local part is reduced to its first and last character.
 * "ahmed.k@gmail.com" -> "a*****k@gmail.com".
 */
function maskEmail(email) {
  const value = String(email || "");
  const at = value.lastIndexOf("@");
  if (at < 1) return "";

  const local = value.slice(0, at);
  const domain = value.slice(at);
  if (local.length <= 2) return `${local[0]}*${domain}`;
  return `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}${domain}`;
}

/**
 * The signed-in customer's affiliate ID and everyone who registered with it.
 *
 * One level only — these are the people who typed this user's code into the
 * signup form, not their referrals' referrals.
 *
 * Customers only. Staff are not in the program, so this refuses rather than
 * minting them an ID as a side effect of loading a page they should not see.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!canHaveAffiliateId(session.role)) {
    return Response.json(
      { message: "Affiliate IDs are for customer accounts only." },
      { status: 403 }
    );
  }

  try {
    // ensureReferralCode rather than a plain read: an account that somehow has
    // no code would otherwise be shown an empty box with nothing to share.
    const [referralCode, referrals] = await Promise.all([
      ensureReferralCode(session.userId),
      prisma.user.findMany({
        where: { referredById: session.userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          // Orders are counted, never listed: how many purchases a referral has
          // made is a fair measure of the referrer's contribution, but what
          // they bought is nobody else's business.
          _count: { select: { orders: true } },
        },
      }),
    ]);

    return Response.json({
      referralCode,
      referralsCount: referrals.length,
      referrals: referrals.map((r) => ({
        id: r.id,
        name: r.name,
        maskedEmail: maskEmail(r.email),
        joinedAt: r.createdAt,
        ordersCount: r._count.orders,
      })),
    });
  } catch (err) {
    const isDbDown = err?.code === "P1001";
    return Response.json(
      {
        message: isDbDown
          ? "Database is unreachable. Please ensure PostgreSQL is running."
          : "Failed to load your referrals.",
      },
      { status: 503 }
    );
  }
}
