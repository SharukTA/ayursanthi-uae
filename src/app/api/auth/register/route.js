import { prisma } from "@/lib/prisma";
import { hashPassword, setSession } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";
import { queueEmail } from "@/lib/email-queue";
import {
  validateRegistration,
  validateReferralCode,
  normalizePhone,
  normalizeReferralCode,
} from "@/lib/validation";
import { createUniqueReferralCode, findReferrerByCode } from "@/lib/referral";

export const runtime = "nodejs";

/**
 * Create the account, minting its own affiliate ID.
 *
 * The mint is retried rather than trusted first time: two signups can pick the
 * same code in the same instant, and the @unique index — not the availability
 * check inside createUniqueReferralCode — is what settles it. Only a conflict
 * on referralCode is retried; a duplicate email or phone is a real, already
 * reported condition and must keep bubbling up.
 */
async function createUserWithReferralCode(data) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.user.create({
        data: {
          ...data,
          role: "CUSTOMER", // default
          referralCode: await createUniqueReferralCode(data.name),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          referralCode: true,
          createdAt: true,
        },
      });
    } catch (error) {
      const isCodeConflict =
        error?.code === "P2002" && error?.meta?.target?.includes?.("referralCode");
      if (!isCodeConflict || attempt >= 2) throw error;
    }
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone, password, referralCode } = body;

    // Validation — mirrors the client-side checks so the API can't be bypassed.
    const errors = validateRegistration({ name, email, phone, password });
    // Affiliate ID is optional and only offered on the main signup page, so it
    // is validated separately rather than inside validateRegistration — the
    // inline signup at checkout shares that function and never sends one.
    const referralFormatError = validateReferralCode(referralCode);
    if (referralFormatError) errors.referralCode = referralFormatError;
    if (Object.keys(errors).length > 0) {
      return Response.json(
        { message: Object.values(errors)[0], errors },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone && phone.trim() ? normalizePhone(phone) : null;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanEmail },
          ...(cleanPhone ? [{ phone: cleanPhone }] : []),
        ],
      },
    });

    if (existingUser) {
      const isEmail = existingUser.email === cleanEmail;
      const field = isEmail ? "email" : "phone";
      const label = isEmail ? "email" : "phone number";
      const message = `A user with this ${label} is already registered.`;
      return Response.json({ message, errors: { [field]: message } }, { status: 400 });
    }

    // Resolve the affiliate ID they were referred by, if they entered one.
    // Checked BEFORE the account is created so a typo costs them a corrected
    // form field, not an account that silently lost its attribution — the code
    // can never be added afterwards.
    const cleanReferralCode = normalizeReferralCode(referralCode);
    let referredById = null;
    if (cleanReferralCode) {
      const referrer = await findReferrerByCode(cleanReferralCode);
      if (!referrer) {
        const message = `No account was found with the affiliate ID "${cleanReferralCode}". Please check it, or leave the field blank.`;
        return Response.json(
          { message, errors: { referralCode: message } },
          { status: 400 }
        );
      }
      referredById = referrer.id;
    }

    // Hash password
    const passwordHash = hashPassword(password);

    const newUser = await createUserWithReferralCode({
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash,
      referredById,
    });

    // Set the session cookie
    await setSession({
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });

    // Non-blocking welcome email: a messaging failure or slow gateway must
    // never break the signup response. Queued via after() rather than left as a
    // bare un-awaited call, because a serverless host can freeze the function
    // the moment the response is flushed and drop the send entirely.
    queueEmail(() => sendWelcomeEmail({ name: newUser.name, email: newUser.email }));

    return Response.json(
      {
        message: "Registration successful",
        user: newUser,
        // Signals the client to confirm the welcome letter via a snackbar.
        welcomeEmailSent: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return Response.json(
      { message: "Internal server error during registration." },
      { status: 500 }
    );
  }
}
