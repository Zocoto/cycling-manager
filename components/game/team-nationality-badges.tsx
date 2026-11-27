"use client";

import Link from "@/components/ui/app-link";
import { useLocale } from "@/components/i18n/locale-provider";

type TeamNationalityBadgesProps = {
  countryCodes: readonly string[];
  dark?: boolean;
};

export function TeamNationalityBadges({ countryCodes, dark = false }: TeamNationalityBadgesProps) {
  const { locale } = useLocale();
  const countryNames = new Intl.DisplayNames([locale], { type: "region" });
  const codes = [...new Set(countryCodes.map(code => code.trim().toUpperCase()))]
    .filter(code => /^[A-Z]{2}$/.test(code));
  if (codes.length === 0) return null;

  return (
    <div data-team-nationalities>
      <p className={`text-[10px] font-extrabold uppercase tracking-[0.12em] ${dark ? "text-white/75" : "text-[#60756E]"}`}>
        {codes.length > 1 ? "Nationalités de l’équipe" : "Nationalité de l’équipe"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {codes.map(code => {
          const name = countryNames.of(code) ?? code;
          return (
            <Link
              key={code}
              href={`/jeu/nations/${code.toLowerCase()}`}
              prefetchOnIntent
              className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${dark ? "border-white/20 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white" : "border-[#315B3E]/15 bg-[#EAF5F3] text-[#193F38] hover:bg-[#D7EEE8] focus-visible:ring-[#176951]"}`}
            >
              <span role="img" aria-label={`Drapeau : ${name}`} className={`fi fi-${code.toLowerCase()} h-3.5 w-5 shrink-0 overflow-hidden rounded-sm shadow-sm`} />
              <span>{name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
