import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error", "warn"],
    // Prisma's defaults (maxWait 2s, timeout 5s) assume a database next door.
    // Ours is a Neon instance in eu-central-1 reached through the pooler, and it
    // autosuspends when idle — so the first write after a quiet spell pays a
    // cold-start plus a round trip per statement. A multi-statement transaction
    // (product update, checkout, order status) blows the 5s budget and fails
    // with P2028 "Transaction already closed", then succeeds on retry once the
    // compute is warm. These ceilings are not a fix for slow queries; they just
    // stop a cold connection from being mistaken for one.
    transactionOptions: {
      maxWait: 10000,
      timeout: 15000,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}