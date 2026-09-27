import { cache } from "react";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { settings } from "@/db/schema";

/**
 * Typed settings service (spec §4.4) — replaces the legacy loose
 * settings/frontend_settings key/value rows. One JSON blob per domain,
 * Zod-validated with defaults so a missing row never crashes a page.
 */

export const systemSettingsSchema = z.object({
  name: z.string().default("Academy LMS"),
  title: z.string().default("Academy LMS"),
  email: z.string().default("system@academy-next.test"),
  timezone: z.string().default("UTC"),
  language: z.string().default("english"),
  currencyCode: z.string().default("USD"),
  currencySymbol: z.string().default("$"),
  currencyPosition: z.enum(["left", "right"]).default("left"),
  instructorRevenuePercent: z.number().min(0).max(100).default(70),
  courseSellingTax: z.number().min(0).default(0),
  allowInstructor: z.boolean().default(true),
  studentEmailVerification: z.boolean().default(false),
  allowedDeviceLogins: z.number().int().min(0).default(0),
  recaptchaSiteKey: z.string().default(""),
  recaptchaSecretKey: z.string().default(""),
  accountDisableMessage: z
    .string()
    .default("Your account has been disabled. Please contact the administrator."),
  googleLogin: z.boolean().default(true),
  facebookLogin: z.boolean().default(true),
  linkedinLogin: z.boolean().default(false),
  certificateQuizThreshold: z.number().min(0).max(100).default(0),
  smtpHost: z.string().default(""),
  smtpPort: z.number().int().default(587),
  smtpUser: z.string().default(""),
  smtpFrom: z.string().default(""),
  openaiEnabled: z.boolean().default(false),
  watermarkText: z.string().default(""),
  cookieConsent: z.boolean().default(true),
  dripEnabled: z.boolean().default(false),
  affiliateCommissionPercent: z.number().min(0).max(100).default(10),
});
export type SystemSettings = z.infer<typeof systemSettingsSchema>;

export const frontendSettingsSchema = z.object({
  heroTitle: z.string().default("Learn anything, anywhere"),
  heroSubTitle: z
    .string()
    .default("Premium courses taught by world-class instructors. Start today."),
  footerText: z.string().default("© Academy LMS. All rights reserved."),
  facebook: z.string().default(""),
  twitter: z.string().default(""),
  linkedin: z.string().default(""),
});
export type FrontendSettings = z.infer<typeof frontendSettingsSchema>;

export const getSettings = cache(
  async <S extends z.ZodTypeAny>(key: string, schema: S): Promise<z.infer<S>> => {
    const rows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    const parsed = schema.safeParse(rows[0]?.value ?? {});
    return parsed.success ? parsed.data : schema.parse({});
  },
);

export const getSystemSettings = () => getSettings("system", systemSettingsSchema);
export const getFrontendSettings = () => getSettings("frontend", frontendSettingsSchema);
