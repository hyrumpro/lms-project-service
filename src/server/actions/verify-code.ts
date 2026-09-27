"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { consumeEmailCode } from "@/server/actions/auth-extra";

export async function consumeEmailCodeAction(email: string, code: string) {
  const ok = await consumeEmailCode(email, code);
  if (!ok) return { ok: false as const };
  await db
    .update(user)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(user.email, email.toLowerCase()));
  await db.update(user).set({ emailVerified: true }).where(eq(user.email, email));
  return { ok: true as const };
}
