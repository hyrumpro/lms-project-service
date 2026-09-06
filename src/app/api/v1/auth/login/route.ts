import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { account, user } from "@/db/schema";
import { signLegacyToken, verifyLegacyToken, bearerToken } from "@/lib/jwt-legacy";

/**
 * POST /api/v1/auth/login — legacy mobile app contract.
 * Body: { email, password } → { status, token, user }
 * (mirrors Api.php::login_get response shape)
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;
  if (!body?.email || !body?.password) {
    return NextResponse.json({ status: false, message: "email and password required" }, { status: 400 });
  }

  const [accountRow] = await db
    .select({ userId: account.userId, password: account.password })
    .from(account)
    .innerJoin(user, eq(user.id, account.userId))
    .where(eq(user.email, body.email.toLowerCase()))
    .limit(1);

  if (!accountRow?.password) {
    return NextResponse.json({ status: false, message: "Invalid credentials" }, { status: 401 });
  }

  const { verifyPassword } = await import("better-auth/crypto");
  const valid = await verifyPassword({ password: body.password, hash: accountRow.password });
  if (!valid) {
    return NextResponse.json({ status: false, message: "Invalid credentials" }, { status: 401 });
  }

  const [userRow] = await db.select().from(user).where(eq(user.id, accountRow.userId)).limit(1);
  if (userRow.status === "disabled") {
    return NextResponse.json({ status: false, message: "Account disabled" }, { status: 403 });
  }

  const jwt = await signLegacyToken(userRow.id);

  return NextResponse.json({
    status: true,
    token: jwt,
    user: {
      user_id: userRow.id,
      first_name: userRow.firstName,
      last_name: userRow.lastName,
      email: userRow.email,
      image: userRow.image,
      is_instructor: userRow.isInstructor,
    },
  });
}

/** GET /api/v1/auth/login?token=… — legacy token introspection (GetTokenData). */
export async function GET(request: Request) {
  const token = bearerToken(request) ?? new URL(request.url).searchParams.get("token") ?? "";
  const payload = await verifyLegacyToken(token);
  if (!payload) {
    return NextResponse.json({ status: false, message: "Invalid token" }, { status: 401 });
  }
  return NextResponse.json({ status: true, user_id: payload.userId });
}
