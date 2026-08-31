import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { consumeRateLimit, rateLimitedResponse, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Submit (or update) a customer review for a product.
 *
 * Reviews are real, customer-generated content — never admin-authored. To keep
 * them trustworthy we gate posting to *verified buyers*: the user must have a
 * PAID order that contains this product. The ProductReview table enforces one
 * review per user per product (@@unique([userId, productId])), so a second
 * submission updates the existing row rather than creating a duplicate.
 */
export async function POST(request, { params }) {
  const { slug } = await params;

  const session = await getSession();
  if (!session) {
    return Response.json({ message: "Please sign in to write a review." }, { status: 401 });
  }

  // Keyed by account, and placed before the body is read so a loop costs one
  // indexed lookup rather than the purchase lookup and the upsert below. The
  // verified-buyer gate already makes this hard to abuse at all; this caps the
  // one thing it does not stop, which is rewriting the same review over and over.
  const limit = await consumeRateLimit({
    key: `review:user:${session.userId}`,
    ...RATE_LIMITS.reviewPost,
  });
  if (!limit.allowed) {
    return rateLimitedResponse(
      limit.retryAfter,
      "Too many review submissions. Please wait a while and try again."
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid request body." }, { status: 400 });
  }

  const rating = Number(body.rating);
  const comment = String(body.comment || "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return Response.json({ message: "Please select a rating from 1 to 5 stars." }, { status: 400 });
  }
  if (comment.length > 2000) {
    return Response.json({ message: "Your review is too long (2000 characters max)." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true, isActive: true },
  });
  if (!product || !product.isActive) {
    return Response.json({ message: "Product not found." }, { status: 404 });
  }

  // Verified-purchase gate: the user must own a PAID order containing this product.
  const purchased = await prisma.orderItem.findFirst({
    where: {
      productId: product.id,
      order: { userId: session.userId, paymentStatus: "PAID" },
    },
    select: { id: true },
  });
  if (!purchased) {
    return Response.json(
      { message: "Only verified buyers can review this product." },
      { status: 403 }
    );
  }

  const review = await prisma.productReview.upsert({
    where: { userId_productId: { userId: session.userId, productId: product.id } },
    create: { userId: session.userId, productId: product.id, rating, comment: comment || null },
    update: { rating, comment: comment || null },
  });

  return Response.json(
    { success: true, message: "Thanks! Your review has been posted.", review },
    { status: 201 }
  );
}
