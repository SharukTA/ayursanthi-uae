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

// Same PBKDF2 scheme as src/lib/auth.js (salt:hash, 1000 rounds, sha512, 64
// bytes) so the password verifies correctly at login. Keep these in sync.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
}

// Mirrors the referral-code style used by the registration route.
function generateReferralCode(name) {
  const prefix = String(name || "ADM")
    .replace(/[^a-zA-Z]/g, "")
    .substring(0, 4)
    .toUpperCase();
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

async function uniqueReferralCode(name) {
  let code = generateReferralCode(name);
  while (await prisma.user.findUnique({ where: { referralCode: code } })) {
    code = generateReferralCode(name);
  }
  return code;
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

  let user;
  if (existing) {
    // Promote/refresh an existing account — don't touch its wallet or referral code.
    user = await prisma.user.update({
      where: { email },
      data: { passwordHash, role: "ADMIN", name },
    });
    console.log(`Updated existing user to ADMIN: ${email}`);
  } else {
    user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
        role: "ADMIN",
        referralCode: await uniqueReferralCode(name),
        wallet: { create: { balance: 0.0, pendingBalance: 0.0 } },
      },
    });
    console.log(`Created new ADMIN: ${email}`);
  }

  // Make sure the admin has a wallet even if the account predated wallets.
  await prisma.wallet.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, balance: 0.0, pendingBalance: 0.0 },
  });

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
