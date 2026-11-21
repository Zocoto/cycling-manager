import "server-only";

import { cookies, headers } from "next/headers";

import {
  LOCALE_COOKIE_NAME,
  normalizeLocale,
  type AppLocale,
} from "@/lib/i18n/config";
import { PUBLIC_LOCALE_HEADER } from "@/lib/i18n/public-routes";

export async function getRequestLocale(): Promise<AppLocale> {
  const requestHeaders = await headers();
  const publicLocale = requestHeaders.get(PUBLIC_LOCALE_HEADER);

  if (publicLocale === "fr" || publicLocale === "en") {
    return publicLocale;
  }

  const cookieStore = await cookies();

  return normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
}
