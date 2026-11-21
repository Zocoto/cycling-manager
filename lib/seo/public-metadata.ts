import type { Metadata } from "next";

import { getAbsoluteUrl } from "@/lib/app-config";
import type { AppLocale } from "@/lib/i18n/config";
import { getLocalizedPublicHref, getPublicRouteInfo } from "@/lib/i18n/public-routes";

export function buildPublicMetadata({
  path,
  locale,
  title,
  description,
  absoluteTitle = false,
}: {
  path: string;
  locale: AppLocale;
  title: string;
  description: string;
  absoluteTitle?: boolean;
}): Metadata {
  const route = getPublicRouteInfo(path);
  const canonical = getAbsoluteUrl(getLocalizedPublicHref(path, locale));
  const languages = route?.availableLocales.includes("en")
    ? {
        fr: getAbsoluteUrl(getLocalizedPublicHref(path, "fr")),
        en: getAbsoluteUrl(getLocalizedPublicHref(path, "en")),
        "x-default": getAbsoluteUrl(getLocalizedPublicHref(path, "fr")),
      }
    : undefined;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical, ...(languages ? { languages } : {}) },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      locale: locale === "en" ? "en_GB" : "fr_FR",
      ...(languages ? { alternateLocale: [locale === "en" ? "fr_FR" : "en_GB"] } : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
