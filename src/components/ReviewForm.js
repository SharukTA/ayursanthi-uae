"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star, CheckCircle2, AlertCircle } from "lucide-react";

// Customer-facing "write a review" widget shown on the product page.
//
// This is the *submission* side of the real review system — the displayed
// reviews above it come from the ProductReview table. Posting is gated to
// verified buyers (enforced again server-side in the reviews API route); this
// component just adapts what it shows based on the viewer's state:
//   - signed out          -> prompt to sign in
//   - signed in, no buy   -> "verified buyers only" notice
//   - verified buyer      -> the rating + comment form (prefilled if they
//                            already reviewed, which then updates their review)
export function ReviewForm({ slug, isLoggedIn, canReview, existingReview }) {
  const router = useRouter();
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(existingReview?.comment || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!isLoggedIn) {
    return (
      <div className="mt-6 rounded-md border border-border bg-white p-5 text-sm text-[#3f4545]">
        <Link href="/login" className="font-bold text-[#0f1111] underline">
          Sign in
        </Link>{" "}
        to write a review.
      </div>
    );
  }

  if (!canReview) {
    return (
      <div className="mt-6 flex items-center gap-2 rounded-md border border-border bg-white p-5 text-sm text-[#3f4545]">
        <AlertCircle className="size-4 shrink-0" />
        Only verified buyers can review this product. Purchase it to share your experience.
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (rating < 1) {
      setError("Please select a star rating.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${slug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Could not post your review.");
        return;
      }
      setSuccess(data.message || "Your review has been posted.");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-md border border-border bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-[#0f1111]">
        {existingReview ? "Update your review" : "Write a review"}
      </p>

      {/* Star picker */}
      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            className="p-0.5"
          >
            <Star
              className={`size-6 transition-colors ${
                star <= (hover || rating) ? "text-amber-500" : "text-[#d5d9d9]"
              }`}
              fill="currentColor"
              stroke="currentColor"
            />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="Share what you liked (or didn't) about this product…"
        className="mt-4 w-full rounded-md border border-border bg-white p-3 text-sm text-slate-800 outline-none focus:border-[#007185]"
      />

      {error ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-red-600">
          <AlertCircle className="size-3.5" />
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="size-3.5" />
          {success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 inline-flex items-center justify-center rounded-md bg-[#232f3e] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0f5251] disabled:opacity-60"
      >
        {submitting ? "Posting…" : existingReview ? "Update review" : "Submit review"}
      </button>
    </form>
  );
}
