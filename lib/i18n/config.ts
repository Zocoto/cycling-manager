export const SUPPORTED_LOCALES = ["fr", "en"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "fr";
export const LOCALE_COOKIE_NAME = "cyclostratege-locale";

export function normalizeLocale(value?: string | null): AppLocale {
  const normalized = value?.trim().toLowerCase().split(/[-_]/)[0];

  return normalized === "en" ? "en" : DEFAULT_LOCALE;
}
export function getIntlLocale(locale: AppLocale): string {
  return locale === "en" ? "en-GB" : "fr-FR";
}
