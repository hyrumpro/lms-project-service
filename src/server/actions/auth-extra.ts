"use server";

import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { verification } from "@/db/schema";
import { getSystemSettings } from "@/lib/settings";
import { sendEmail } from "@/server/services/email";

export async function assertRecaptcha(token: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const system = await getSystemSettings();
  if (!system.recaptchaSecretKey) return { ok: true };
  if (!token) return { ok: false, error: "captcha_required" };
  const body = new URLSearchParams({ secret: system.recaptchaSecretKey, response: token });
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json()) as { success?: boolean };
  return json.success ? { ok: true } : { ok: false, error: "captcha_failed" };
}

export async function issueEmailCode(email: string): Promise<{ ok: boolean }> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const identifier = `email-code:${email.toLowerCase()}`;
  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier,
    value: code,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  await sendEmail({
    to: email,
    subject: "Your Academy verification code",
    html: `<p>Your verification code is <strong>${code}</strong>. It expires in 15 minutes.</p>`,
    text: `Your verification code is ${code}`,
  });
  return { ok: true };
}

export async function consumeEmailCode(email: string, code: string): Promise<boolean> {
  const identifier = `email-code:${email.toLowerCase()}`;
  const [row] = await db
    .select()
    .from(verification)
    .where(and(eq(verification.identifier, identifier), eq(verification.value, code), gt(verification.expiresAt, new Date())))
    .orderBy(desc(verification.createdAt))
    .limit(1);
  if (!row) return false;
  await db.delete(verification).where(eq(verification.id, row.id));
  return true;
}
