import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

/**
 * i18n via cookie (spec §7.14) — en + es, no route restructuring.
 * The switcher sets NEXT_LOCALE; full /[locale] path segments can be layered
 * on later without changing these dictionaries.
 */
export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export const LOCALE_COOKIE = "NEXT_LOCALE";

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale = locales.includes(cookieLocale as Locale) ? cookieLocale! : "en";
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
