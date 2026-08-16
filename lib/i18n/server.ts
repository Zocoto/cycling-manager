import "server-only";

import { cookies } from "next/headers";

import {
  LOCALE_COOKIE_NAME,
  normalizeLocale,
  type AppLocale,
} from "@/lib/i18n/config";

export async function getRequestLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();

  return normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
}
