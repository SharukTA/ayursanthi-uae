import { revalidatePath } from "next/cache";

import { jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { freezeDraw, getDraw, publishDraw, runDraw } from "@/lib/gift-draw";
import { formatDrawDate } from "@/lib/gift-shared";
import { sendGiftDrawWinnerEmails } from "@/lib/email-gifts";

export const runtime = "nodejs";

// POST /api/admin/gifts/draws/[id]/action — advance a draw along its lifecycle.
//
// The three transitions live behind one endpoint because they are one sequence
// (freeze, run, publish) and the UI drives them from one button that changes
// label. Each is refused out of order by the library functions themselves, so
// this route is a thin translation of their result into a message an admin can
// act on — it never decides eligibility.

// Outcomes that are not failures: the requested state was already reached, which
// is exactly what a double-click or a retried request looks like.
const BENIGN = new Set(["already_frozen", "already_drawn", "already_published"]);

// `too_early` is deliberately absent: it is the one refusal that needs the draw
// date interpolated into it, so it is handled on its own below rather than as a
// fixed string here.
const MESSAGES = {
  not_frozen: "Close the entry list first — winners can only be drawn from a frozen list.",
  no_prizes: "Add at least one prize to this draw before running it.",
  no_entries: "Nobody qualified for this draw, so there is nothing to draw from.",
  not_drawn: "Run the draw before publishing its winners.",
  not_published: "Publish the draw before emailing its winners.",
  already_frozen: "The entry list for this draw is already closed.",
  already_drawn: "This draw has already been run — its winners cannot be re-rolled.",
  already_published: "These winners are already published.",
};

export async function POST(request, { params }) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    const draw = await prisma.giftDraw.findUnique({ where: { id } });
    if (!draw) return jsonError("Draw not found.", 404);

    let result;
    if (action === "freeze") {
      result = await freezeDraw(draw.cycleKey);
    } else if (action === "run") {
      result = await runDraw({ drawId: id, adminUserId: session.userId });
    } else if (action === "publish") {
      result = await publishDraw(id);
      // /gifts is statically revalidated every 5 minutes, which is the right
      // cadence for poster and prize edits but not for this: publishing is the
      // store committing to a result in public, and the admin who pressed the
      // button will go and look at the page. Without this they would find the
      // previous winners still listed for up to five minutes and have no way to
      // tell a cache from a bug.
      //
      // In a route handler this marks the path rather than rebuilding it, so
      // the cost lands on the next visitor to /gifts, not on this request.
      if (result.status === "published") revalidatePath("/gifts");
    } else if (action === "notify") {
      // Retry for winners the publish-time send did not reach. Only ever
      // touches rows still PENDING, so pressing it twice cannot mail anyone a
      // second time.
      if (draw.status !== "PUBLISHED") {
        return jsonError(MESSAGES.not_published, 409);
      }
      const notified = await sendGiftDrawWinnerEmails(id);
      result = { status: "notified", notified };
    } else {
      return jsonError('Action must be one of "freeze", "run", "publish" or "notify".');
    }

    if (result.status === "not_found") return jsonError("Draw not found.", 404);

    // The one refusal that needs a date in it, so the admin knows how long to
    // wait rather than being told only that it is too soon.
    if (result.status === "too_early") {
      const held = formatDrawDate(result.draw?.drawDate ?? draw.drawDate);
      return jsonError(
        `This draw is held on ${held}. Entries stay open until then — it cannot be closed or run early. ` +
          "Change the draw day in Settings if the date itself is wrong.",
        409
      );
    }

    // A refusal the admin has to act on (wrong order, nothing to draw for).
    // The benign ones fall through and report success, because the state they
    // asked for is the state that exists.
    if (MESSAGES[result.status] && !BENIGN.has(result.status)) {
      return jsonError(MESSAGES[result.status], 409);
    }

    // Surfaced so the admin sees whether the winners were actually reached
    // rather than assuming publishing was the end of it.
    const notified = result.notified;
    const note = BENIGN.has(result.status)
      ? MESSAGES[result.status]
      : notified
        ? `${notified.sent} winner${notified.sent === 1 ? "" : "s"} emailed` +
          (notified.failed ? `, ${notified.failed} could not be reached` : ".")
        : null;

    return Response.json({
      status: result.status,
      note,
      notified: notified ?? null,
      draw: await getDraw(id),
    });
  } catch (err) {
    return prismaErrorResponse(err, "Could not update the draw.");
  }
}
