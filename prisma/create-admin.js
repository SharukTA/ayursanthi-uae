// Creates (or updates) a single ADMIN user. Unlike seed.demo.js this script is
// SAFE to run against production: it never deletes anything and is idempotent —
// run it as many times as you like.
//
// Credentials come from environment variables so no password is ever committed
// to git. Usage (PowerShell):
//
//   $env:ADMIN_EMAIL="you@yourdomain.com"
//   $env:ADMIN_PASSWORD="a-strong-password"
//   node prisma/create-admin.js
//
// Optional: ADMIN_NAME (defaults to "Administrator"), ADMIN_PHONE.
//
// DATABASE_URL is read from .env via prisma.config.ts / dotenv, exactly like the
// migrations were — so this targets whatever database that points at (Neon).
require("dotenv/config");
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

// Same PBKDF2 scheme as src/lib/auth.js — pbkdf2$sha512$<rounds>$<salt>$<hash>,
// 210,000 rounds (the OWASP floor for SHA-512), 64-byte output — so the password
// verifies correctly at login. Keep these in sync; this file cannot import the
// real one because it is CommonJS and runs outside the Next.js module graph.
//
// The round count is written into the string rather than assumed at verify time,
// which is what lets src/lib/auth.js raise it later without invalidating rows
// written here.
const PBKDF2_ITERATIONS = 210000;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, "sha512")
    .toString("hex");
  return `pbkdf2$sha512$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = (process.env.ADMIN_NAME || "Administrator").trim();
  const phone = process.env.ADMIN_PHONE
    ? process.env.ADMIN_PHONE.trim()
    : null;

  if (!email || !password) {
    console.error(
      "Missing credentials. Set ADMIN_EMAIL and ADMIN_PASSWORD, e.g.\n" +
        '  $env:ADMIN_EMAIL="you@yourdomain.com"; $env:ADMIN_PASSWORD="secret"; node prisma/create-admin.js'
    );
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("ADMIN_PASSWORD must be at least 6 characters long.");
    process.exit(1);
  }

  const passwordHash = hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      // Resetting an admin's password here revokes their existing sessions too,
      // for the same reason the reset flow does: this script is how you recover
      // an account you believe is compromised, and that is worthless if the
      // cookie already issued for it keeps working.
      data: { passwordHash, role: "ADMIN", name, sessionsValidFrom: new Date() },
    });
    console.log(`Updated existing user to ADMIN: ${email}`);
  } else {
    await prisma.user.create({
      data: { name, email, phone, passwordHash, role: "ADMIN" },
    });
    console.log(`Created new ADMIN: ${email}`);
  }

  console.log("Done. You can now log in at /login with this email.");
}

main()
  .catch((e) => {
    console.error("Failed to create admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
