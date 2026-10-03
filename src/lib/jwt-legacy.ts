import { SignJWT, jwtVerify } from "jose";

/**
 * Legacy mobile-app JWT compatibility (spec §3.11, §7.17).
 * Same HS256 secret and payload shape as the original TokenHandler so the
 * existing apps keep working during the migration window.
 *
 * SECURITY: the original secret was shipped inside the mobile clients, so it is
 * not a real secret — anyone can forge a token. `LEGACY_JWT_SECRET` lets you
 * rotate the key (re-sign the apps to follow). New clients should prefer the
 * Better-Auth session token that `/api/v1` now also accepts (see mobile.ts).
 */
const LEGACY_SECRET = process.env.LEGACY_JWT_SECRET || "academy-lms-api-token-handler";
const key = new TextEncoder().encode(LEGACY_SECRET);

export async function signLegacyToken(userId: string, days = 30): Promise<string> {
  return new SignJWT({ user_id: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(key);
}

export async function verifyLegacyToken(
  token: string,
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, key);
    const userId = (payload.user_id as string) ?? (payload.sub as string);
    return userId ? { userId } : null;
  } catch {
    return null;
  }
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}
