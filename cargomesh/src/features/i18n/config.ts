export const LOCALE_COOKIE = "cargomesh-locale";

export const SUPPORTED_LOCALES = ["es", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function parseLocale(value: string | null | undefined): Locale {
  return value === "es" ? "es" : "en";
}

export function localeTag(locale: Locale) {
  return locale === "en" ? "en-US" : "es-PE";
}

export function translate(locale: Locale, spanish: string, english: string) {
  return locale === "en" ? english : spanish;
}
