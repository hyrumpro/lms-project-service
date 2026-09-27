import { readFileSync } from "node:fs";
import path from "node:path";
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LEGACY_FILE, LOCALE_COOKIE, locales, type Locale } from "@/i18n/locales";

const phraseCache = new Map<string, Record<string, string>>();

function loadLegacyPhrases(locale: Locale): Record<string, string> {
  const cached = phraseCache.get(locale);
  if (cached) return cached;
  const file = path.join(process.cwd(), "..", "Academy-LMS", "languages", `${LEGACY_FILE[locale]}.json`);
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, string | null>;
    const phrases: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "string" || value.length === 0) continue;
      phrases[key.replaceAll(".", "\u00b7")] = value;
    }
    phraseCache.set(locale, phrases);
    return phrases;
  } catch {
    phraseCache.set(locale, {});
    return {};
  }
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale = locales.includes(cookieLocale as Locale) ? (cookieLocale as Locale) : "en";
  const appMessages = (await import(`../../messages/${locale === "es" ? "es" : "en"}.json`)).default;
  return {
    locale,
    messages: {
      ...appMessages,
      phrase: loadLegacyPhrases(locale),
    },
  };
});
