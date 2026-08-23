-- Auth hardening: session revocation + a shared rate-limit store.
--
-- Both are additive and safe to apply to a live database: no existing column
-- changes type, nothing is backfilled, and no row is rewritten.

-- AlterTable
--
-- The cut-off that makes a password change actually kick out existing sessions.
-- Sessions are self-contained encrypted cookies, so before this there was no
-- server-side handle on an issued token at all — a stolen cookie survived a
-- password reset for the remaining 7 days of its life, which defeats the point
-- of resetting.
--
-- Deliberately NULL for every existing account, meaning "nothing has ever been
-- revoked, every otherwise-valid token passes". Backfilling it with NOW() would
-- sign the entire customer base out the moment this deploys.
ALTER TABLE "User" ADD COLUMN     "sessionsValidFrom" TIMESTAMP(3);

-- CreateTable
--
-- Fixed-window counters for the auth rate limiter (src/lib/rate-limit.js).
-- Production is serverless, so an in-process counter is worthless: instances are
-- many and short-lived, and an attacker simply arrives on a fresh one. This
-- table is the only state they share.
--
-- "key" is the primary key rather than a surrogate id so the hot path can be a
-- single atomic INSERT ... ON CONFLICT DO UPDATE ... RETURNING, which is what
-- stops a burst of parallel attempts all reading the same count and all
-- deciding they are under the limit.
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
-- Supports the opportunistic sweep of windows that have already closed; rows are
-- disposable and are never read after their window ends.
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");
