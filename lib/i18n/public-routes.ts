import type { AppLocale } from "@/lib/i18n/config";

export const PUBLIC_LOCALE_HEADER = "x-cyclostratege-public-locale";

/** Only pages with English content may be exposed below /en. */
export const PUBLIC_LOCALIZED_ROUTES = [
  { fr: "/", en: "/en" },
  { fr: "/guide", en: "/en/guide" },
  { fr: "/a-propos", en: "/en/about" },
  { fr: "/presse", en: "/en/press" },
  { fr: "/guide/premieres-courses", en: "/en/guide/premieres-courses" },
  { fr: "/guide/entrainement-forme", en: "/en/guide/entrainement-forme" },
  { fr: "/guide/recrutement-budget", en: "/en/guide/recrutement-budget" },
] as const;

const FRENCH_PUBLIC_ROUTES = new Set([
  "/nouveautes",
  "/mentions-legales",
  "/confidentialite",
  "/conditions-utilisation",
]);

export type PublicRouteInfo = {
  locale: AppLocale;
  canonicalPath: string;
  localizedPath: string;
  availableLocales: readonly AppLocale[];
};

/** Account, authentication, API and game paths deliberately have no public locale. */
export function getPublicRouteInfo(pathname: string): PublicRouteInfo | null {
  const route = PUBLIC_LOCALIZED_ROUTES.find(
    (entry) => entry.fr === pathname || entry.en === pathname,
  );

  if (route) {
    const locale = route.en === pathname ? "en" : "fr";

    return {
      locale,
      canonicalPath: route.fr,
      localizedPath: route[locale],
      availableLocales: ["fr", "en"],
    };
  }

  if (
    FRENCH_PUBLIC_ROUTES.has(pathname) ||
    /^\/nouveautes\/[^/]+$/.test(pathname)
  ) {
    return {
      locale: "fr",
      canonicalPath: pathname,
      localizedPath: pathname,
      availableLocales: ["fr"],
    };
  }

  return null;
}

/** Keep the query and fragment byte-for-byte; leave every unlisted href alone. */
export function getLocalizedPublicHref(href: string, locale: AppLocale): string {
  const suffixIndex = href.search(/[?#]/);
  const pathname = suffixIndex < 0 ? href : href.slice(0, suffixIndex);
  const suffix = suffixIndex < 0 ? "" : href.slice(suffixIndex);
  const route = PUBLIC_LOCALIZED_ROUTES.find(
    (entry) => entry.fr === pathname || entry.en === pathname,
  );

  return route ? `${route[locale]}${suffix}` : href;
}

/** Account links carry the language before hydration, without changing their other parameters. */
export function getAuthenticationLocaleHref(href: string, locale: AppLocale): string {
  const hashIndex = href.indexOf("#");
  const hash = hashIndex < 0 ? "" : href.slice(hashIndex);
  const beforeHash = hashIndex < 0 ? href : href.slice(0, hashIndex);
  const queryIndex = beforeHash.indexOf("?");
  const pathname = queryIndex < 0 ? beforeHash : beforeHash.slice(0, queryIndex);
  if (pathname !== "/connexion" && pathname !== "/inscription") return href;

  const query = queryIndex < 0 ? "" : beforeHash.slice(queryIndex + 1);
  const parameters = query ? query.split("&").filter(parameter => {
    const name = parameter.split("=", 1)[0];
    try { return decodeURIComponent(name.replace(/\+/g, " ")) !== "lang"; }
    catch { return true; }
  }) : [];
  parameters.push(`lang=${locale}`);
  return `${pathname}?${parameters.join("&")}${hash}`;
}
