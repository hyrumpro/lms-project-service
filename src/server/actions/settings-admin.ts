"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getSystemSettings, systemSettingsSchema } from "@/lib/settings";

const templateSchema = z.object({
  event: z.enum([
    "course_status",
    "purchase_instructor",
    "purchase_admin",
    "certificate",
    "gift",
    "withdrawal_requested",
    "withdrawal_approved",
    "withdrawal_cancelled",
  ]),
  enabled: z.boolean(),
  subject: z.string().max(180),
  body: z.string().max(8000),
});

export async function saveSystemSettingsForm(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/sign-in");
  const current = await getSystemSettings();
  const next = systemSettingsSchema.parse({
    ...current,
    name: String(formData.get("name") ?? current.name),
    email: String(formData.get("email") ?? current.email),
    instructorRevenuePercent: Number(formData.get("instructorRevenuePercent") ?? current.instructorRevenuePercent),
    courseSellingTax: Number(formData.get("courseSellingTax") ?? current.courseSellingTax),
    allowInstructor: formData.get("allowInstructor") === "on",
    studentEmailVerification: formData.get("studentEmailVerification") === "on",
    allowedDeviceLogins: Number(formData.get("allowedDeviceLogins") ?? current.allowedDeviceLogins),
    recaptchaSiteKey: String(formData.get("recaptchaSiteKey") ?? ""),
    recaptchaSecretKey: String(formData.get("recaptchaSecretKey") ?? ""),
    googleLogin: formData.get("googleLogin") === "on",
    facebookLogin: formData.get("facebookLogin") === "on",
    linkedinLogin: formData.get("linkedinLogin") === "on",
    certificateQuizThreshold: Number(formData.get("certificateQuizThreshold") ?? 0),
    smtpHost: String(formData.get("smtpHost") ?? ""),
    smtpPort: Number(formData.get("smtpPort") ?? 587),
    smtpUser: String(formData.get("smtpUser") ?? ""),
    smtpFrom: String(formData.get("smtpFrom") ?? ""),
    openaiEnabled: formData.get("openaiEnabled") === "on",
    watermarkText: String(formData.get("watermarkText") ?? ""),
    cookieConsent: formData.get("cookieConsent") === "on",
    dripEnabled: formData.get("dripEnabled") === "on",
    affiliateCommissionPercent: Number(formData.get("affiliateCommissionPercent") ?? 10),
  });
  await db
    .insert(settings)
    .values({ key: "system", value: next })
    .onConflictDoUpdate({ target: settings.key, set: { value: next } });
  revalidatePath("/", "layout");
  redirect("/admin/settings");
}

export async function saveEmailTemplate(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/sign-in");
  const parsed = templateSchema.safeParse({
    event: String(formData.get("event") ?? ""),
    enabled: formData.get("enabled") === "on",
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.success) return;
  const [row] = await db.select().from(settings).where(eq(settings.key, "email_templates"));
  const current = (row?.value ?? {}) as Record<string, { enabled: boolean; subject: string; body: string }>;
  current[parsed.data.event] = {
    enabled: parsed.data.enabled,
    subject: parsed.data.subject,
    body: parsed.data.body,
  };
  await db
    .insert(settings)
    .values({ key: "email_templates", value: current })
    .onConflictDoUpdate({ target: settings.key, set: { value: current } });
  redirect("/admin/emails");
}
