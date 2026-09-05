"use client";

import Link from "@/components/ui/app-link";
import { useLocale } from "@/components/i18n/locale-provider";

export function CyclogazetteSectionNavigation({
  activeSection,
}: {
  activeSection: "journal" | "awards";
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";

  return (
    <nav
      aria-label={isEnglish ? "Cyclogazette sections" : "Rubriques de La Cyclogazette"}
      className="mx-auto mb-5 flex max-w-[1380px] overflow-hidden border border-[#241F18]/60 bg-[#241F18] p-1 text-[#F4EBD2] shadow-[0_12px_35px_rgba(45,34,20,0.18)]"
    >
      <SectionLink
        href="/jeu/gazette"
        active={activeSection === "journal"}
        label={isEnglish ? "Today's paper" : "Le journal"}
        description={isEnglish ? "Front page and archives" : "Une et archives"}
      />
      <SectionLink
        href="/jeu/gazette?onglet=awards"
        active={activeSection === "awards"}
        label={isEnglish ? "Peloton awards" : "Awards du peloton"}
        description={isEnglish ? "Season honours" : "Palmarès des saisons"}
      />
    </nav>
  );
}

function SectionLink({
  href,
  active,
  label,
  description,
}: {
  href: string;
  active: boolean;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-14 min-w-0 flex-1 items-center justify-between gap-3 px-4 py-2 transition sm:px-6 ${
        active
          ? "bg-[#F4EBD2] text-[#241F18]"
          : "text-[#E7D9B8] hover:bg-white/10"
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate font-serif text-sm font-black sm:text-base">
          {label}
        </span>
        <span className={`hidden text-[9px] font-black uppercase tracking-[0.14em] sm:block ${active ? "text-[#A12742]" : "text-[#C9B98F]"}`}>
          {description}
        </span>
      </span>
      <span aria-hidden="true" className="text-lg font-black">
        {active ? "●" : "○"}
      </span>
    </Link>
  );
}
