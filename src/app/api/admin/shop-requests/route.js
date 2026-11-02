import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { OWNER_CONTACT_FIELDS, sharesContact } from "@/lib/shop";

export const runtime = "nodejs";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const requests = await prisma.shopRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      ownerName: true,
      phone: true,
      email: true,
      investmentAed: true,
      createdAt: true,
      referrerShop: { select: { ownerName: true, ...OWNER_CONTACT_FIELDS } },
    },
  });

  return Response.json({
    requests: requests.map(({ referrerShop, ...request }) => ({
      ...request,
      investmentAed: Number(request.investmentAed),
      referrerName: referrerShop?.ownerName ?? null,
      // Whether this may be the referrer referring themselves, for the admin to judge.
      referrerSameContact: referrerShop
        ? sharesContact({ emails: [request.email], phones: [request.phone] }, referrerShop)
        : false,
    })),
  });
}
