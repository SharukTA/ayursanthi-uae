import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

// Trim a posted address field to a string, or "" if absent.
function field(value) {
  return String(value || "").trim();
}

// POST /api/gifts/wins/:id/claim — a drawn winner (or a referrer who received a
// mirror gift) submits a shipping address to claim their gift. We verify the win
// belongs to the caller and is still WON, store the address snapshot, and move it
// to CLAIMED so it enters the admin fulfillment queue. Idempotent-safe.
export async function POST(request, { params }) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json(
      { message: "Please sign in to claim your gift." },
      { status: 401 }
    );
  }

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid request body." }, { status: 400 });
  }

  const address = {
    fullName: field(body.fullName),
    phone: field(body.phone),
    line1: field(body.line1),
    line2: field(body.line2),
    city: field(body.city),
    state: field(body.state),
    postalCode: field(body.postalCode),
    country: field(body.country) || "India",
  };

  if (
    !address.fullName ||
    !address.phone ||
    !address.line1 ||
    !address.city ||
    !address.state ||
    !address.postalCode
  ) {
    return Response.json(
      { message: "Please fill in name, phone, address, city, state, and PIN code." },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const win = await tx.giftWin.findUnique({ where: { id } });
      if (!win || win.userId !== session.userId) throw new Error("NOT_FOUND");
      if (win.status !== "WON") throw new Error("ALREADY_CLAIMED");

      return tx.giftWin.update({
        where: { id },
        data: { status: "CLAIMED", addressSnapshot: address },
      });
    });

    return Response.json({
      message: "Your gift is being prepared for shipping! We'll update you soon.",
      status: updated.status,
    });
  } catch (error) {
    if (error?.message === "NOT_FOUND") {
      return Response.json({ message: "Gift not found." }, { status: 404 });
    }
    if (error?.message === "ALREADY_CLAIMED") {
      return Response.json(
        { message: "You've already claimed this gift." },
        { status: 409 }
      );
    }
    console.error(error);
    return Response.json(
      { message: "Unable to claim your gift right now." },
      { status: 500 }
    );
  }
}
