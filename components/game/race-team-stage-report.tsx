"use client";

import { useMemo, useState } from "react";
import Link from "@/components/ui/app-link";
import { useLocale } from "@/components/i18n/locale-provider";
import { buildTeamJournalView } from "@/lib/game/race-journal-view";
import type { TeamStageEvent, TeamStageReport, TeamStageRiderReport } from "@/lib/game/race-team-stage-report";

const NUMBERS = {
  fr: new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }),
  en: new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }),
};
const STATUS_LABELS = {
  finished: ["Arrivée", "Finished"], did_not_start: ["Non-partant", "DNS"],
  did_not_finish: ["Abandon", "DNF"], disqualified: ["Disqualifié", "Disqualified"],
  outside_time_limit: ["Hors délai", "Outside time limit"], withdrawn: ["Retiré", "Withdrawn"],
} as const;
const ENGLISH_ROLES: Record<string, string> = {
  "Leader": "Leader", "Leader sprinteur": "Sprint leader", "Sprinteur": "Sprinter",
  "Coureur protégé": "Protected rider", "Équipier": "Domestique", "Électron libre": "Free role",
  "Poisson-pilote": "Lead-out rider", "Poisson pilote": "Lead-out rider",
  "Leader / sprinteur": "Leader / sprinter", "Automatique": "Automatic", "Classement montagne": "Mountains classification",
};
const ENGLISH_EVENT_TITLES: Record<string, string> = {
  "Protection": "Protection", "Aide au retour": "Chase support", "Travail en tête du peloton": "Work at the front of the peloton",
  "Lancement du sprint": "Sprint lead-out", "En échappée": "In the breakaway",
  "En contre-attaque / poursuite": "Counter-attack / chase", "Décrochage": "Dropped",
  "Retour dans le peloton": "Back in the peloton", "Crevaison / avarie": "Puncture / mechanical",
  "Bordure": "Crosswind split", "Chute collective": "Mass crash", "Chute": "Crash", "Abandon sur chute": "DNF after a crash",
  "Attaque / accélération": "Attack / acceleration", "Soutien / retour": "Support / return", "Perte de contact": "Losing contact",
  "Fait de course": "Race event", "Passage au GPM": "Mountain prime", "Sprint intermédiaire": "Intermediate sprint",
};

function rankLabel(rank: number, en: boolean) {
  if (!en) return `${rank}e`;
  const last = rank % 100;
  return `${rank}${last >= 11 && last <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[rank % 10] ?? "th"}`;
}
function gap(ms: number) {
  const seconds = Math.round(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : `${seconds} s`;
}
function resultLabel(rider: TeamStageRiderReport, en: boolean) {
  return rider.result.status === "finished" && rider.result.rank !== null
    ? rankLabel(rider.result.rank, en) : STATUS_LABELS[rider.result.status][en ? 1 : 0];
}

/** Mounted only when the unified journal's team view is opened. */
export function RaceTeamStageReport({ report }: { report: TeamStageReport | null }) {
  const { locale } = useLocale();
  const en = locale === "en";
  const model = useMemo(() => report ? buildTeamJournalView(report) : null, [report]);
  if (!report || !model) return null;
  return <div data-race-team-journal className="min-w-0 space-y-4">
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[#315B3E]/10 pb-3">
      <p className="min-w-0 text-sm font-bold text-[#0B302B] [overflow-wrap:anywhere]">
        <span data-i18n-skip>{report.teamName}</span>
        <span className="ml-2 text-xs font-semibold text-[#60756E]">{model.finishedCount} / {report.riders.length} {en ? "riders finished" : "coureurs à l’arrivée"}</span>
      </p>
      {model.best ? <p className="min-w-0 text-xs font-semibold text-[#60756E]">
        {en ? "Best result: " : "Meilleur résultat : "}
        <Link href={`/jeu/coureurs/${model.best.result.riderId}`} className="font-black text-[#176951] underline decoration-[#176951]/30 underline-offset-4"><span data-i18n-skip>{model.best.result.riderName}</span></Link>
        {" · "}{model.best.result.rank === 1 ? en ? "Victory" : "Victoire" : rankLabel(model.best.result.rank!, en)}
        {model.best.result.gapToWinnerMs !== null && model.best.result.gapToWinnerMs > 0 ? ` · +${gap(model.best.result.gapToWinnerMs)}` : ""}
      </p> : null}
    </div>

    {model.overview.length ? <TeamJournalEvents events={model.overview} riderNames={model.riderNames} en={en} /> : <p className="rounded-xl bg-white/70 p-3 text-sm leading-6 text-[#60756E]">
      {en ? "No detailed race events are available for this stage. Official results remain available below." : "Aucun fait détaillé disponible pour cette étape. Les résultats officiels restent accessibles ci-dessous."}
    </p>}
    {model.overview.length < model.eventCount ? <p className="text-xs leading-5 text-[#60756E]">
      {en ? "The key moments are shown here. All recorded events remain available in each rider's details." : "Les faits principaux sont présentés ici. Tous les événements enregistrés restent disponibles dans le détail de chaque coureur."}
    </p> : null}

    <div className="min-w-0 rounded-xl border border-[#315B3E]/12 bg-white/70">
      <p className="border-b border-[#315B3E]/10 px-3 py-3 text-xs font-black text-[#0B302B]">{en ? "Rider details" : "Détail des coureurs"}</p>
      {report.riders.map(rider => <RiderJournalDetails key={rider.result.riderId} rider={rider} events={model.eventsByRider.get(rider.result.riderId) ?? []} riderNames={model.riderNames} en={en} />)}
    </div>
    {report.tactics.length ? <details className="rounded-xl border border-[#315B3E]/12 bg-white/70 px-3">
      <summary className="flex min-h-11 cursor-pointer items-center py-3 text-xs font-black text-[#176951]">{en ? "Tactical briefing review" : "Bilan du briefing tactique"}</summary>
      <div className="space-y-2 pb-3">{report.tactics.map((text, index) => <p key={index} className="text-xs leading-5 text-[#315B3E] [overflow-wrap:anywhere]">{text}</p>)}</div>
    </details> : null}
    <p className="text-[11px] leading-5 text-[#60756E]">
      {report.hasTimeline
        ? en ? "Group changes are located at recorded course checkpoints; distances between observations are estimates." : "Les changements de groupe sont repérés aux points enregistrés du parcours ; les distances sont estimées entre ces observations."
        : en ? "The detailed scenario is unavailable. This report uses official results only." : "Le scénario détaillé de cette étape n’est pas disponible. Le bilan présente les résultats officiels."}
      {report.hasWorkRecording
        ? en ? " Support actions come from work recorded during the simulation." : " Les actions de soutien proviennent du travail enregistré pendant la simulation."
        : en ? " Protection, chase and lead-out distances were not recorded for this stage." : " Le détail des distances de protection, de poursuite et de lancement n’a pas été enregistré sur cette étape."}
    </p>
  </div>;
}

function RiderJournalDetails({ rider, events, riderNames, en }: { rider: TeamStageRiderReport; events: TeamStageEvent[]; riderNames: Map<string, string>; en: boolean }) {
  const [open, setOpen] = useState(false);
  const number = NUMBERS[en ? "en" : "fr"];
  const work = rider.workKm;
  const metrics: Array<[string, number | null | undefined, boolean]> = [
    [en ? "Breakaway" : "Échappée", rider.breakawayKm, true],
    [en ? "Breakaway turns" : "Relais dans l’échappée", rider.relayKm, true],
    [en ? "Protection" : "Protection", work?.protection, false],
    [en ? "Chase support" : "Aide au retour", work?.recovery, false],
    [en ? "At the front of the peloton" : "En tête du peloton", work?.peloton, false],
    [en ? "Sprint lead-out" : "Lancement du sprint", work?.leadout, false],
  ];
  const gapMs = rider.result.gapToWinnerMs;
  return <details data-rider-journal={rider.result.riderId} className="min-w-0 border-b border-[#315B3E]/10 last:border-0" onToggle={event => {
    if (event.target === event.currentTarget) setOpen(event.currentTarget.open);
  }}>
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 focus-visible:outline-2 focus-visible:outline-[#176951] [&::-webkit-details-marker]:hidden">
      <span className="min-w-0 text-sm font-bold text-[#0B302B] [overflow-wrap:anywhere]" data-i18n-skip>{rider.result.riderName}</span>
      <span className="flex shrink-0 items-center gap-2 text-xs font-black text-[#176951]">{resultLabel(rider, en)}<span aria-hidden="true">{open ? "−" : "＋"}</span></span>
    </summary>
    {open ? <div className="min-w-0 space-y-3 px-3 pb-4" data-rider-journal-content>
      <p className="text-xs font-semibold leading-5 text-[#60756E]">
        {rider.role ? <span className="block">{en ? "Starting role: " : "Rôle au départ : "}{en ? ENGLISH_ROLES[rider.role] ?? rider.role : rider.role}</span> : null}
        {rider.result.status === "finished"
          ? gapMs !== null && Number.isFinite(gapMs) ? gapMs > 0 ? `+${gap(gapMs)}` : en ? "Same time as the winner" : "Dans le temps du vainqueur"
            : en ? "Gap unavailable" : "Écart indisponible"
          : rider.result.abandonmentReason ?? STATUS_LABELS[rider.result.status][en ? 1 : 0]}
        {rider.energyAfter !== null ? ` · ${en ? "Energy at the finish" : "Réserve à l’arrivée"} : ${Math.round(rider.energyAfter)} %` : ""}
      </p>
      <ul className="space-y-1 text-xs leading-5 text-[#315B3E]">{metrics.filter(([, value]) => value !== null && value !== undefined && Number.isFinite(value) && value > 0).map(([label, value, estimated]) => <li key={label}>{label} : {estimated ? "≈ " : ""}{number.format(value!)} km</li>)}</ul>
      {events.length ? <TeamJournalEvents events={events} riderNames={riderNames} en={en} /> : null}
      <Link href={`/jeu/coureurs/${rider.result.riderId}`} className="inline-flex min-h-11 items-center text-xs font-black text-[#176951] underline underline-offset-4">{en ? "Open rider profile" : "Ouvrir la fiche du coureur"}</Link>
    </div> : null}
  </details>;
}

function TeamJournalEvents({ events, riderNames, en }: { events: TeamStageEvent[]; riderNames: Map<string, string>; en: boolean }) {
  const number = NUMBERS[en ? "en" : "fr"];
  return <ol className="ml-2 min-w-0 border-l border-[#315B3E]/15" data-team-journal-events>
    {events.map(event => <li key={event.id} className="relative grid min-w-0 gap-1 py-2.5 pl-4 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-3">
      <span aria-hidden="true" className="absolute -left-[4px] top-4 h-2 w-2 rounded-full bg-[#278B70] ring-4 ring-[#F3F8F5]" />
      <span className="text-[10px] font-black leading-6 text-[#176951]">{event.id.startsWith("work-") ? "Km" : en ? "Around km" : "Vers le km"} {number.format(event.distanceKm)}{event.endKm !== undefined ? `–${number.format(event.endKm)}` : ""}</span>
      <p className="min-w-0 text-sm leading-6 text-[#48665F] [overflow-wrap:anywhere]"><strong className="text-[#0B302B]">{en ? ENGLISH_EVENT_TITLES[event.title] ?? event.title : event.title}.</strong>{" "}
        {event.id.startsWith("work-") && riderNames.has(event.riderIds[0]) ? <>
          <span data-i18n-skip>{riderNames.get(event.riderIds[0])}</span>
          {event.riderIds.length > 1 ? <>{en ? " for " : " pour "}<span data-i18n-skip>{event.riderIds.slice(1).map(id => riderNames.get(id)).filter(Boolean).join(", ")}</span></> : null}.
        </> : event.detail}
      </p>
    </li>)}
  </ol>;
}
