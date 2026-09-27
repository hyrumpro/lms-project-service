export const locales = [
  "en",
  "es",
  "ar",
  "zh",
  "fr",
  "ka",
  "de",
  "hi",
  "id",
  "it",
  "km",
  "pt",
  "ro",
  "ru",
  "tr",
  "ur",
] as const;

export type Locale = (typeof locales)[number];

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const RTL_LOCALES = new Set<Locale>(["ar", "ur"]);

export const LEGACY_FILE: Record<Locale, string> = {
  en: "english",
  es: "spanish",
  ar: "arabic",
  zh: "chinese",
  fr: "french",
  ka: "georgian",
  de: "german",
  hi: "hindi",
  id: "indonesia",
  it: "italian",
  km: "khmer",
  pt: "portuguese",
  ro: "romanian",
  ru: "russian",
  tr: "turkish",
  ur: "urdu",
};

export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  es: "Español",
  ar: "العربية",
  zh: "中文",
  fr: "Français",
  ka: "ქართული",
  de: "Deutsch",
  hi: "हिन्दी",
  id: "Indonesia",
  it: "Italiano",
  km: "ភាសាខ្មែរ",
  pt: "Português",
  ro: "Română",
  ru: "Русский",
  tr: "Türkçe",
  ur: "اردو",
};
