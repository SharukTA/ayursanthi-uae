import { prisma } from "@/lib/prisma";
import {
  cleanString,
  jsonError,
  prismaErrorResponse,
  readMoney,
  requireAdmin,
} from "@/lib/admin-api";
import { formatMoney } from "@/lib/currency";
import { getShopWithdrawalMinimum } from "@/lib/settings";
import { getShopTotals } from "@/lib/shop";
import { readJsonObject } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Writes down commission the store has paid a partner. The money itself moves
 * outside this system, so this is only the record of it, and it is what the
 * partner's balance is measured against.
 */
export async function POST(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await readJsonObject(request);

    const amount = Number(readMoney(body.amount));
    if (!amount) return jsonError("Please enter the amount paid.");

    const shop = await prisma.shop.findUnique({ where: { id }, select: { id: true } });
    if (!shop) return jsonError("Shop not found.", 404);

    // Paying outside the request and then marking it paid would record the money twice.
    const waiting = await prisma.shopWithdrawal.findFirst({
      where: { shopId: id, status: "PENDING" },
      select: { id: true },
    });
    if (waiting) {
      return jsonError("This shop has a withdrawal request waiting. Please mark that as paid or decline it first.");
    }

    const [totalsById, minimum] = await Promise.all([getShopTotals([id]), getShopWithdrawalMinimum()]);
    const totals = totalsById.get(id);
    // Measured on the balance, so a partial payment from a balance that has reached the
    // minimum is still allowed.
    if (totals.balance < minimum) {
      return jsonError(
        `This shop has ${formatMoney(totals.balance)} available, which is below the ${formatMoney(minimum)} minimum withdrawal.`
      );
    }
    if (amount > totals.balance) {
      return jsonError(`That is more than the ${formatMoney(totals.balance)} currently payable.`);
    }

    const payout = await prisma.shopPayout.create({
      data: { shopId: id, amount, note: cleanString(body.note) },
      select: { id: true },
    });

    // Two admins recording at the same moment can both pass the check above. If together
    // they went over the balance, this one is taken back. If both do that, neither is
    // recorded, which is safe, and the admin just tries again.
    const after = (await getShopTotals([id])).get(id);
    if (after.balance < 0) {
      await prisma.shopPayout.deleteMany({ where: { id: payout.id } });
      return jsonError("Another payment was recorded at the same moment. Please reload and try again.", 409);
    }

    return Response.json({ payout }, { status: 201 });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to record the payout.");
  }
}
