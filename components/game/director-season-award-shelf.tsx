"use client";

import { useEffect, useRef, useState } from "react";

import { SeasonAwardMedalMark } from "@/components/game/season-award-medal-mark";
import {
  SEASON_AWARD_PRESENTATION,
  compareSeasonAwards,
  type SeasonAwardKey,
} from "@/lib/game/season-awards";

export type DirectorSeasonAward = {
  id: string;
  key: SeasonAwardKey;
  title: string;
  description: string;
  seasonName: string;
  gameYear: number;
  statValue: number | null;
  statLabel: string | null;
};

export function DirectorSeasonAwardShelf({
  awards,
  theme = "dark",
}: {
  awards: DirectorSeasonAward[];
  theme?: "dark" | "light";
}) {
  if (awards.length === 0) return null;

  const sortedAwards = [...awards].sort(compareSeasonAwards);

  return (
    <section
      aria-label="Awards de fin de saison"
      className={`mt-4 rounded-2xl border px-3 py-3 ${
        theme === "dark"
          ? "border-white/12 bg-black/15"
          : "border-[#315B3E]/12 bg-white/10"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className={`text-[9px] font-black uppercase tracking-[0.18em] ${theme === "dark" ? "text-[#A8DEC6]" : "text-[#D2F1E1]"}`}>
          Awards du DS
        </p>
        <span className={`text-[9px] font-bold ${theme === "dark" ? "text-[#9FB5A8]" : "text-white/65"}`}>
          {awards.length} médaille{awards.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex max-w-full gap-3 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:thin]">
        {sortedAwards.map((award) => (
          <InteractiveAwardMedal key={award.id} award={award} />
        ))}
      </div>
    </section>
  );
}

function InteractiveAwardMedal({ award }: { award: DirectorSeasonAward }) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipId = `season-award-${award.id}`;
  const presentation = SEASON_AWARD_PRESENTATION[award.key];

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: PointerEvent) => {
      if (!buttonRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [isOpen]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className="group relative flex w-[68px] shrink-0 cursor-help flex-col items-center border-0 bg-transparent p-0 text-inherit focus-visible:outline-none"
      aria-label={`${presentation.fr.title}, ${award.seasonName}`}
      aria-describedby={tooltipId}
      aria-expanded={isOpen}
      onClick={() => setIsOpen((open) => !open)}
      onBlur={() => setIsOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setIsOpen(false);
          event.currentTarget.blur();
        }
      }}
    >
      <span className="transition group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5">
        <SeasonAwardMedalMark awardKey={award.key} className="h-14 w-14" />
      </span>
      <span className="relative z-10 -mt-1 rounded-full border border-white/25 bg-[#071A17] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-[#F7DA73] shadow-md">
        S{award.gameYear}
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className={`mobile-dock-clearance pointer-events-none absolute bottom-[calc(100%+0.7rem)] left-1/2 z-50 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-[#071A17] px-3 py-3 text-left text-xs leading-5 text-[#D6DFD2] shadow-2xl transition max-sm:fixed max-sm:inset-x-4 max-sm:bottom-4 max-sm:left-auto max-sm:w-auto max-sm:translate-x-0 ${
          isOpen
            ? "visible opacity-100"
            : "invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
        }`}
      >
        <strong className="block font-black text-[#F2C94C]">{presentation.fr.title}</strong>
        <span className="mt-0.5 block">{presentation.fr.description}</span>
        <span className="mt-2 block border-t border-white/10 pt-2 font-bold text-[#A8DEC6]">
          {award.seasonName}
          {award.statValue !== null && award.statLabel
            ? ` · ${award.statValue.toLocaleString("fr-FR")} ${award.statLabel}`
            : ""}
        </span>
      </span>
    </button>
  );
}
