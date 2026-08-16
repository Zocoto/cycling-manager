"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { useLocale } from "@/components/i18n/locale-provider";
import {
  LOCALE_COOKIE_NAME,
  type AppLocale,
} from "@/lib/i18n/config";

const OPTIONS: ReadonlyArray<{ locale: AppLocale; label: string }> = [
  { locale: "fr", label: "FR" },
  { locale: "en", label: "EN" },
];

function persistLocale(nextLocale: AppLocale) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { locale, setLocale } = useLocale();
  const [isPending, startTransition] = useTransition();
  const accessibleLabel =
    locale === "en" ? "Choose the site language" : "Choisir la langue du site";

  function selectLocale(nextLocale: AppLocale) {
    if (nextLocale === locale) {
      return;
    }

    persistLocale(nextLocale);
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

        return (
          <button
            key={option.locale}
            type="button"
            onClick={() => selectLocale(option.locale)}
            aria-pressed={isActive}
            disabled={isPending}
            title={
              locale === "en"
                ? option.locale === "fr"
                  ? "Display in French"
                  : "Display in English"
                : option.locale === "fr"
                  ? "Afficher en français"
                  : "Afficher en anglais"
            }
            className={`inline-flex h-8 min-w-9 cursor-pointer items-center justify-center rounded-lg px-2 text-[0.68rem] font-black tracking-[0.1em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF4] disabled:cursor-wait disabled:opacity-70 ${
              isActive
                ? "bg-[#F2C94C] text-[#071A17] shadow-sm"
                : "text-[#FFFDF4] hover:bg-white/10 hover:text-[#F2C94C]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
