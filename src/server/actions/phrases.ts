"use server";

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LEGACY_FILE, locales, type Locale } from "@/i18n/locales";

export async function savePhrase(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/sign-in");
  const locale = String(formData.get("locale") ?? "en");
  const key = String(formData.get("key") ?? "");
  const value = String(formData.get("value") ?? "");
  if (!locales.includes(locale as Locale) || !key) return;
  const file = path.join(process.cwd(), "..", "Academy-LMS", "languages", `${LEGACY_FILE[locale as Locale]}.json`);
  const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  parsed[key] = value;
  writeFileSync(file, JSON.stringify(parsed));
  redirect(`/admin/languages?locale=${locale}`);
}

export async function importPhrases(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/sign-in");
  const locale = String(formData.get("locale") ?? "en");
  const raw = String(formData.get("json") ?? "");
  if (!locales.includes(locale as Locale)) return;
  const incoming = JSON.parse(raw) as Record<string, string>;
  const file = path.join(process.cwd(), "..", "Academy-LMS", "languages", `${LEGACY_FILE[locale as Locale]}.json`);
  const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  writeFileSync(file, JSON.stringify({ ...parsed, ...incoming }));
  redirect(`/admin/languages?locale=${locale}`);
}
