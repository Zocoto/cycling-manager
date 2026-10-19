"use client";

import { useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { RaceTeamStageReport } from "./race-team-stage-report";
import { SponsorRaceBriefPanel } from "./sponsor-project-panel";
import type { SponsorRaceBrief } from "@/lib/game/sponsor-project";
import { RACE_JOURNAL_VIEW_STORAGE_KEY, resolveRaceJournalView, type RaceJournalView } from "@/lib/game/race-journal-view";
import type { TeamStageReport } from "@/lib/game/race-team-stage-report";
import type { RaceCourseJournalEntry, RaceCourseJournalEntryKind } from "@/lib/game/race-course-journal";

const KIND_STYLES: Record<RaceCourseJournalEntryKind, { dot: string; fr: string; en: string }> = {
  start: { dot: "bg-[#8CA69B]", fr: "Départ", en: "Start" },
  breakaway: { dot: "bg-[#E1A82B]", fr: "Échappée", en: "Breakaway" },
  gap: { dot: "bg-[#D47E34]", fr: "Écart", en: "Gap" },
  junction: { dot: "bg-[#4B8EB5]", fr: "Jonction", en: "Junction" },
  attack: { dot: "bg-[#B84B52]", fr: "Attaque", en: "Attack" },
  incident: { dot: "bg-[#7D5BB1]", fr: "Incident", en: "Incident" },
  selection: { dot: "bg-[#278B70]", fr: "Sélection", en: "Selection" },
  finish: { dot: "bg-[#F2C94C]", fr: "Arrivée", en: "Finish" },
};

export function RaceCourseJournal({ entries, teamReport = null, sponsorRaceBrief = null }: {
  entries: RaceCourseJournalEntry[];
  teamReport?: TeamStageReport | null;
  sponsorRaceBrief?: SponsorRaceBrief | null;
}) {
  const { locale } = useLocale();
  const en = locale === "en";
  const [isOpen, setIsOpen] = useState(false);
  const [preferredView, setPreferredView] = useState<RaceJournalView>("race");
  const hasTeam = Boolean(teamReport?.riders.length);
  const view = resolveRaceJournalView(preferredView, entries.length > 0, hasTeam);
  if (entries.length === 0 && !hasTeam) return null;

  function changeView(next: RaceJournalView) {
    setPreferredView(next);
    try { window.localStorage.setItem(RACE_JOURNAL_VIEW_STORAGE_KEY, next); } catch { /* Storage may be disabled. */ }
  }

  return (
    <details data-race-course-journal className="group/journal min-w-0 border-b border-[#315B3E]/12 bg-[linear-gradient(135deg,#F3F8F5,#FFFDF5)]"
      onToggle={event => {
        if (event.target !== event.currentTarget) return;
        const open = event.currentTarget.open;
        setIsOpen(open);
        if (open) {
          try {
            setPreferredView(resolveRaceJournalView(window.localStorage.getItem(RACE_JOURNAL_VIEW_STORAGE_KEY), entries.length > 0, hasTeam));
          } catch { /* Keep the usable in-memory preference. */ }
        }
      }}>
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 transition hover:bg-white/55 focus-visible:outline-2 focus-visible:outline-[#176951] sm:px-8 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#0B302B] text-lg text-white shadow-sm">≡</span>
          <span className="min-w-0">
            <span className="block text-base font-black text-[#0B302B] sm:text-lg">{en ? "Race report" : "Journal de course"}</span>
            <span className="mt-1 block text-xs font-semibold leading-5 text-[#688176]">{hasTeam
              ? en ? "The race story and your team's key moments" : "Le déroulement de l’épreuve et les faits marquants de votre équipe"
              : en ? "Breakaways, gaps, attacks and key incidents" : "Échappées, écarts, attaques et incidents marquants"}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {entries.length > 0 ? <span className="hidden rounded-full border border-[#315B3E]/12 bg-white px-3 py-1.5 text-[10px] font-black text-[#48665F] sm:inline-flex">
            {entries.length} {en ? "key moments" : "faits marquants"}
          </span> : null}
          <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full border border-[#315B3E]/15 bg-white text-[#176951] transition group-open/journal:rotate-180">⌄</span>
        </span>
      </summary>
      {isOpen ? <div className="min-w-0 border-t border-[#315B3E]/10 px-4 pb-5 pt-3 sm:px-8">
        {hasTeam && entries.length > 0 ? <div role="group" aria-label={en ? "Report view" : "Lecture du journal"} className="mb-4 grid max-w-md grid-cols-2 gap-1 rounded-xl bg-[#0B302B]/[0.06] p-1">
          {(["race", "team"] as const).map(next => <button key={next} type="button" aria-pressed={view === next}
            onClick={() => changeView(next)}
            className={`min-h-11 min-w-0 rounded-lg px-2 py-2 text-sm font-black transition focus-visible:outline-2 focus-visible:outline-[#176951] ${view === next ? "bg-white text-[#0B302B] shadow-sm" : "text-[#60756E] hover:bg-white/60"}`}>
            {next === "race" ? en ? "Whole race" : "Toute la course" : en ? "My team" : "Mon équipe"}
          </button>)}
        </div> : null}
        {view === "team" && teamReport ? <><SponsorRaceBriefPanel brief={sponsorRaceBrief} final /><RaceTeamStageReport report={teamReport} /></> : <RaceJournalTimeline entries={entries} />}
      </div> : null}
    </details>
  );
}

export function RaceJournalTimeline({ entries }: { entries: RaceCourseJournalEntry[] }) {
  const { locale } = useLocale();
  const en = locale === "en";
  const number = new Intl.NumberFormat(en ? "en-GB" : "fr-FR", { maximumFractionDigits: 1 });
  return <ol className="relative ml-2 border-l border-[#315B3E]/15 py-2">
    {entries.map(entry => {
      const style = KIND_STYLES[entry.kind];
      return <li key={entry.id} className="relative grid min-w-0 gap-1 py-2.5 pl-5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-start sm:gap-3">
        <span aria-hidden="true" className={`absolute -left-[5px] top-[1.15rem] h-2.5 w-2.5 rounded-full ring-4 ring-[#F7FAF5] ${style.dot}`} />
        <span className="inline-flex w-fit rounded-full bg-[#0B302B]/[0.06] px-2.5 py-1 text-[10px] font-black text-[#48665F]">
          {entry.kind === "start" || entry.kind === "finish" ? en ? style.en : style.fr : `Km ${number.format(entry.distanceKm)}`}
        </span>
        <p className="min-w-0 text-sm font-semibold leading-6 text-[#48665F] [overflow-wrap:anywhere]">
          <span className="font-black text-[#0B302B]">{entry.title}</span>{" "}
          <span className="sr-only">{en ? style.en : style.fr}. </span>{entry.detail}
        </p>
      </li>;
    })}
  </ol>;
}
