import { prisma } from "@/lib/prisma";
import { verifyPassword, setSession, hashPassword, needsRehash } from "@/lib/auth";
import {
  clientIp,
  consumeRateLimit,
  rateLimitedResponse,
  resetRateLimit,
  RATE_LIMITS,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return Response.json(
        { message: "Login ID and password are required fields." },
        { status: 400 }
      );
    }

    const cleanIdentifier = identifier.trim();

    // Two buckets, because the two attacks are different shapes. Per-IP stops
    // one host spraying many accounts; per-identifier stops a distributed
    // attack concentrating on one account from many hosts. Both are checked
    // BEFORE the password is verified — an attempt that is refused must not
    // even reach the hash comparison, which is now deliberately expensive.
    const ipKey = `login:ip:${clientIp(request)}`;
    const idKey = `login:id:${cleanIdentifier.toLowerCase()}`;

    const [byIp, byId] = await Promise.all([
      consumeRateLimit({ key: ipKey, ...RATE_LIMITS.loginByIp }),
      consumeRateLimit({ key: idKey, ...RATE_LIMITS.loginByIdentifier }),
    ]);

    const limited = !byIp.allowed ? byIp : !byId.allowed ? byId : null;
    if (limited) {
      return rateLimitedResponse(
        limited.retryAfter,
        "Too many sign-in attempts. Please wait a few minutes and try again."
      );
    }

    // Look up the user by email or phone (email is matched case-insensitively)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanIdentifier.toLowerCase() },
          { phone: cleanIdentifier },
        ],
      },
    });

    if (!user) {
      return Response.json(
        { message: "Invalid login ID or password." },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordCorrect = verifyPassword(password, user.passwordHash);
    if (!isPasswordCorrect) {
      return Response.json(
        { message: "Invalid login ID or password." },
        { status: 401 }
      );
    }

    // Correct credentials, so this was not an attack: hand the budget back
    // rather than leaving a customer who fumbled their password a few times
    // locked out of their next sign-in.
    await Promise.all([resetRateLimit(ipKey), resetRateLimit(idKey)]);

    // Opportunistic upgrade of the stored hash. This is the only moment the
    // plaintext is available, so it is the only moment a row written at the old
    // (far too cheap) iteration count can be re-written at the current one.
    // Failing here must never fail the login — the password was correct.
    if (needsRehash(user.passwordHash)) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: hashPassword(password) },
        });
      } catch (error) {
        console.error(`[login] Could not upgrade password hash for ${user.id}:`, error?.message || error);
      }
    }

    // Set user session cookie
    await setSession({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    // Strip password hash before returning user details
    const { passwordHash, ...safeUser } = user;

    return Response.json({
      message: "Login successful",
      user: safeUser,
    });
  } catch (error) {
    console.error("Login error:", error);
    return Response.json(
      { message: "Internal server error during login." },
      { status: 500 }
    );
  }
}
