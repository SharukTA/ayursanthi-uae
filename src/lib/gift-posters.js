// Reading the gift programme's promotional posters. Server-only (prisma); the
// placement list itself lives in lib/gift-shared.js so the admin form can use it
// too.
//
// The posters ARE the gifts page. Everything the campaign promises — the prize,
// the spend needed, the draw date, the hour of the prize giving — is set in the
// artwork by whoever designed it, so the storefront's job is to show the image
// at a size where it can be read and stay out of its way.

import { prisma } from "@/lib/prisma";
import { GIFT_POSTER_PLACEMENTS } from "@/lib/gift-shared";

/**
 * Active posters for one surface, in the order an admin arranged them.
 *
 * "BOTH" is matched in addition to the requested placement rather than being
 * expanded into two rows at write time, so an admin who later decides a poster
 * belongs on one page only changes a dropdown instead of deleting and
 * re-uploading it.
 *
 * @param {"GIFTS"|"DASHBOARD"} placement
 * @param {number} [limit]
 */
export async function getGiftPosters(placement, limit = 12) {
  const surface = GIFT_POSTER_PLACEMENTS.includes(placement) ? placement : "GIFTS";

  return prisma.giftPoster.findMany({
    where: { isActive: true, placement: { in: [surface, "BOTH"] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: limit,
    select: { id: true, title: true, imageUrl: true, linkUrl: true },
  });
}
