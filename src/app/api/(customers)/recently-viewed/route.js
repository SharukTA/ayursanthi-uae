import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { SECTION_PRODUCT_SELECT, toProductItem } from "@/lib/page-sections";
import {
  adoptGuestHistory,
  getAccountHistoryIds,
  HISTORY_STRIP_LIMIT,
  isHistoryEnabled,
  isValidProductId,
  notPurchasedBy,
  recordProductView,
} from "@/lib/browsing-history";

export const runtime = "nodejs";

// Hard cap on ids accepted from a caller. The browser only ever stores
// HISTORY_STRIP_LIMIT; this bounds the query for anyone calling by hand.
const MAX_IDS = HISTORY_STRIP_LIMIT;

// "a,b,c" → a clean, deduped, bounded id list.
function parseIds(raw) {
  return [
    ...new Set(
      String(raw || "")
        .split(",")
        .map((id) => id.trim())
        .filter(isValidProductId)
    ),
  ].slice(0, MAX_IDS);
}

// Resolve product ids into render-ready cards, preserving the given order
// (`id IN (...)` does not) and dropping anything no longer on sale — so a
// retired product silently leaves the strip instead of linking to a 404.
//
// `userId` also drops anything that shopper has already bought. getAccountHistoryIds
// has done that for the account's own ids, but the ids a browser sends alongside
// them have been through no such filter, so a product bought on another device
// would otherwise ride back in on the local list. Signed-out callers pass null:
// there is no account to check purchases against.
async function toCards(ids, userId = null) {
  if (ids.length === 0) return [];
  const products = await prisma.product.findMany({
    where: {
      id: { in: ids },
      isActive: true,
      ...(userId ? notPurchasedBy(userId) : {}),
    },
    select: SECTION_PRODUCT_SELECT,
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter(Boolean).map(toProductItem);
}

// GET /api/recently-viewed[?ids=a,b,c]
//
// Signed out: `ids` is the visitor's own browser history and is the whole story.
// Signed in : the account's history (which follows them across devices) leads,
//             and any ids the browser still holds are appended behind it — this
//             covers the moment between signing in and the client adopting its
//             local list. Products they have already bought are left out of both
//             halves; see notPurchasedBy in lib/browsing-history.js.
//
// Never cached: the response depends on the caller's session and ids, so it must
// not be shared between visitors.
export async function GET(request) {
  const guestIds = parseIds(new URL(request.url).searchParams.get("ids"));

  try {
    const session = await getSession();

    if (!session) {
      return Response.json({ items: await toCards(guestIds), enabled: true });
    }

    // `enabled: false` tells the client to hide the strip AND drop whatever it
    // has cached locally, so turning the switch off on one device takes effect
    // on the others too.
    if (!(await isHistoryEnabled(session.userId))) {
      return Response.json({ items: [], enabled: false });
    }

    const accountIds = await getAccountHistoryIds(session.userId);
    const merged = [...new Set([...accountIds, ...guestIds])].slice(0, MAX_IDS);

    return Response.json({ items: await toCards(merged, session.userId), enabled: true });
  } catch {
    // A failed lookup should hide the strip, not surface an error to a shopper
    // who never asked for it.
    return Response.json({ items: [], enabled: true });
  }
}

// POST /api/recently-viewed — two shapes, both write-only and both no-ops for
// signed-out visitors (whose history never leaves their browser):
//
//   { productId }    record a view, bumping it to the front of the history
//   { adopt: [...] } fold a just-signed-in visitor's browser history into their
//                    account, most-recent-first, without overwriting views the
//                    account already has
//
// Answers 204 in every success case — the caller has nothing to read back, and
// a shopper must never see an error from a background bookkeeping request.
export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) return new Response(null, { status: 204 });

    const body = await request.json();

    if (Array.isArray(body?.adopt)) {
      await adoptGuestHistory(session.userId, body.adopt);
    } else if (body?.productId) {
      await recordProductView(session.userId, body.productId);
    }

    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 204 });
  }
}
