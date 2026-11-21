"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { useLocale } from "@/components/i18n/locale-provider";
import { type AppLocale } from "@/lib/i18n/config";
import { persistLocalePreference } from "@/lib/i18n/client";
import { getLocalizedPublicHref, getPublicRouteInfo } from "@/lib/i18n/public-routes";

const OPTIONS: ReadonlyArray<{ locale: AppLocale; label: string }> = [
  { locale: "fr", label: "FR" },
  { locale: "en", label: "EN" },
];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, setLocale } = useLocale();
  const publicRoute = getPublicRouteInfo(pathname);
  const [isPending, startTransition] = useTransition();
  const accessibleLabel =
    locale === "en" ? "Choose the site language" : "Choisir la langue du site";

  function selectLocale(nextLocale: AppLocale) {
    if (nextLocale === locale) {
      return;
    }

    persistLocalePreference(nextLocale);
    setLocale(nextLocale);
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label={accessibleLabel}
      aria-busy={isPending}
      className={`inline-flex shrink-0 items-center rounded-xl border border-[#F2C94C]/55 bg-black/25 p-1 shadow-inner shadow-black/20 ${compact ? "gap-0" : "gap-1"}`}
    >
      {OPTIONS.map((option) => {
        const isActive = locale === option.locale;
        const title = locale === "en"
          ? option.locale === "fr" ? "Display in French" : "Display in English"
          : option.locale === "fr" ? "Afficher en français" : "Afficher en anglais";
        const className = `inline-flex h-8 min-w-9 cursor-pointer items-center justify-center rounded-lg px-2 text-[0.68rem] font-black tracking-[0.1em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF4] disabled:cursor-wait disabled:opacity-70 ${
          isActive
            ? "bg-[#F2C94C] text-[#071A17] shadow-sm"
            : "text-[#FFFDF4] hover:bg-white/10 hover:text-[#F2C94C]"
        }`;

        if (publicRoute) {
          const hasTranslation = publicRoute.availableLocales.includes(option.locale);
          const href = hasTranslation
            ? getLocalizedPublicHref(pathname, option.locale)
            : "/en";

          return (
            <a
              key={option.locale}
              href={href}
              hrefLang={option.locale}
              lang={option.locale}
              aria-current={isActive ? "page" : undefined}
              onClick={() => persistLocalePreference(option.locale)}
              title={hasTranslation ? title : "English home page"}
              className={className}
              data-navigation-mode="document"
            >
              {option.label}
            </a>
          );
        }

        return (
          <button
            key={option.locale}
            type="button"
            onClick={() => selectLocale(option.locale)}
            aria-pressed={isActive}
            disabled={isPending}
            title={title}
            className={className}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
