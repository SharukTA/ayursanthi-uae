import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

function field(value) {
  return String(value || "").trim();
}

// POST /api/gifts/referral-reward/claim — the customer submits a shipping address
// for the free product they were given for reaching the referral milestone.
//
// Same lifecycle as a gift win (WON -> CLAIMED -> admin ships), but there is no win
// id in the path: a user has at most one referral reward ever (ReferralReward.userId
// is unique), so the session identifies it. Idempotent-safe — a second submit on an
// already-claimed reward is rejected rather than overwriting the address.
export async function POST(request) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json(
      { message: "Please sign in to claim your reward." },
      { status: 401 }
    );
  }

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
      const reward = await tx.referralReward.findUnique({
        where: { userId: session.userId },
      });
      if (!reward) throw new Error("NOT_FOUND");
      if (reward.status !== "WON") throw new Error("ALREADY_CLAIMED");

      return tx.referralReward.update({
        where: { id: reward.id },
        data: { status: "CLAIMED", addressSnapshot: address },
      });
    });

    return Response.json({
      message: "Your free product is being prepared for shipping! We'll update you soon.",
      status: updated.status,
    });
  } catch (error) {
    if (error?.message === "NOT_FOUND") {
      return Response.json({ message: "No referral reward found." }, { status: 404 });
    }
    if (error?.message === "ALREADY_CLAIMED") {
      return Response.json(
        { message: "You've already claimed this reward." },
        { status: 409 }
      );
    }
    console.error(error);
    return Response.json(
      { message: "Unable to claim your reward right now." },
      { status: 500 }
    );
  }
}
