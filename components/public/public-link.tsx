"use client";

import { forwardRef, type ComponentProps } from "react";

import { useLocale } from "@/components/i18n/locale-provider";
import AppLink from "@/components/ui/app-link";
import { persistLocalePreference } from "@/lib/i18n/client";
import { getAuthenticationLocaleHref, getLocalizedPublicHref, getPublicRouteInfo } from "@/lib/i18n/public-routes";

type PublicLinkProps = ComponentProps<typeof AppLink>;

export const PublicLink = forwardRef<HTMLAnchorElement, PublicLinkProps>(
  function PublicLink({ href, onClick, ...props }, ref) {
    const { locale } = useLocale();
    const localizedHref = typeof href === "string"
      ? getLocalizedPublicHref(href, locale)
      : typeof href.pathname === "string" && !href.host && !href.hostname && !href.protocol
        ? { ...href, pathname: getLocalizedPublicHref(href.pathname, locale) }
        : href;
    const pathname = typeof localizedHref === "string"
      ? localizedHref.split(/[?#]/, 1)[0]
      : localizedHref.pathname ?? "";
    const isLocalHref = typeof localizedHref === "string"
      ? localizedHref.startsWith("/") && !localizedHref.startsWith("//")
      : !localizedHref.host && !localizedHref.hostname && !localizedHref.protocol;
    const targetRoute = isLocalHref ? getPublicRouteInfo(pathname) : null;
    const crossesLocale = targetRoute !== null && targetRoute.locale !== locale;
    const entersAuthentication = isLocalHref && (pathname === "/connexion" || pathname === "/inscription");
    const usesDocumentNavigation = crossesLocale || entersAuthentication;
    const navigationHref = !entersAuthentication ? localizedHref
      : typeof localizedHref === "string" ? getAuthenticationLocaleHref(localizedHref, locale)
      : localizedHref.search ? {
        ...localizedHref,
        search: getAuthenticationLocaleHref(`${pathname}${localizedHref.search.startsWith("?") ? "" : "?"}${localizedHref.search}`, locale).slice(pathname.length),
      }
      : typeof localizedHref.query === "string" ? {
        ...localizedHref,
        search: getAuthenticationLocaleHref(`${pathname}?${localizedHref.query}`, locale).slice(pathname.length),
      }
      : { ...localizedHref, query: { ...localizedHref.query, lang: locale } };

    return (
      <AppLink
        ref={ref}
        {...props}
        href={navigationHref}
        data-navigation-mode={usesDocumentNavigation ? "document" : undefined}
        onClick={(event) => {
          onClick?.(event);
          if (!usesDocumentNavigation || event.defaultPrevented || event.button !== 0 ||
            event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
            (event.currentTarget.target && event.currentTarget.target !== "_self") ||
            event.currentTarget.hasAttribute("download")) return;

          // Keep the selected public language when entering the cookie-based account flow.
          let destinationHref = event.currentTarget.href;
          if (entersAuthentication) {
            const sourceRoute = getPublicRouteInfo(window.location.pathname);
            if (sourceRoute) {
              persistLocalePreference(sourceRoute.locale);
              const destination = new URL(destinationHref);
              const localizedDestination = getAuthenticationLocaleHref(`${destination.pathname}${destination.search}${destination.hash}`, sourceRoute.locale);
              destinationHref = new URL(localizedDestination, destination).href;
            }
          }

          // A new document also keeps French-only pages aligned with their server locale.
          event.preventDefault();
          window.location.assign(destinationHref);
        }}
      />
    );
  },
);

export default PublicLink;
