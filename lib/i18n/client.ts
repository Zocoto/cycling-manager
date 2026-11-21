"use client";

import { LOCALE_COOKIE_NAME, type AppLocale } from "@/lib/i18n/config";

export function persistLocalePreference(locale: AppLocale) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
