"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import Link from "@/components/ui/app-link";
import { getSponsorProjectLabel, getSponsorProjectPriorities, type SponsorProject, type SponsorRaceBrief } from "@/lib/game/sponsor-project";
import { getSponsorObjectiveProgressDisplay } from "@/lib/game/sponsor-objective-progress";
import { getSponsorObjectiveStatusPresentation } from "@/lib/game/sponsor-objective-status";
import { SPONSOR_SPORTING_PHILOSOPHY_CONFIG } from "@/lib/game/sponsor-philosophy";
import { SponsorMainObjectiveTermsCard } from "./sponsor-main-objective-terms";
import { SponsorObjectiveName } from "./sponsor-objective-name";
import type { SponsorContractObjective } from "@/services/sponsoring-workflow";

const ENGLISH_PHILOSOPHIES: Record<SponsorProject["philosophy"], string> = {
  cobbled_classics: "Cobbled classics", ardennes_classics: "Hilly classics", medium_stage_races: "Stage races outside Grand Tours",
  time_trials: "Time trials", sprints: "Sprints", grand_tour_general: "Grand Tour general classification",
  national_preference: "National preference", youth_development: "Youth development",
};

export function SponsorProjectPanel({ project, scope }: { project: SponsorProject | null; scope?: "roster" | "youth" }) {
  const { locale } = useLocale(); const en = locale === "en";
  if (!project) return null;
  const priorities = getSponsorProjectPriorities(project, scope);
  if (scope && !priorities.length) return null;
  return <aside data-sponsor-project className="my-5 min-w-0 rounded-2xl border border-[#8970A9]/20 bg-[linear-gradient(120deg,#FAF7FF,#FFFDF5)] p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#71548D]">{en ? "The partner's project" : "Le projet du partenaire"}</p>
      <Link href="/jeu/sponsoring" className="inline-flex min-h-11 items-center text-xs font-bold text-[#71548D] underline underline-offset-4">{en ? "View contract" : "Voir le contrat"}</Link>
    </div>
    <p className="text-sm font-black text-[#0B302B]"><span data-i18n-skip>{project.sponsorName}</span>{" · "}{en ? ENGLISH_PHILOSOPHIES[project.philosophy] : getSponsorProjectLabel(project)}</p>
    {!scope ? <p className="mt-1 text-xs leading-5 text-[#60756E]">{SPONSOR_SPORTING_PHILOSOPHY_CONFIG[project.philosophy].description}</p> : null}
    {priorities.length ? <ul className={`mt-3 gap-2 ${scope ? "flex flex-wrap" : "grid md:grid-cols-3"}`}>{priorities.map(objective => <li key={objective.id} className={`min-w-0 rounded-xl border border-[#8970A9]/10 bg-white/80 p-3 ${scope ? "basis-64 flex-1" : ""}`}>
      <PriorityTitle objective={objective} />
      <ObjectiveProgress objective={objective} en={en} />
    </li>)}</ul> : null}
    <p className="mt-3 text-[10px] leading-5 text-[#72847E]">{scope ? en ? "Progress from the latest contract assessment." : "Progression de la dernière évaluation du contrat." : en ? "Existing contractual priorities. No additional obligation or reward." : "Priorités du contrat existant. Aucune obligation ni récompense supplémentaire."}</p>
  </aside>;
}

function PriorityTitle({ objective }: { objective: SponsorContractObjective }) {
  const target = objective.targetDetails;
  const href = target.kind === "race_result" ? `/jeu/courses/${encodeURIComponent(target.raceSlug)}`
    : target.kind === "rider_recruitment" ? `/jeu/coureurs/${encodeURIComponent(target.riderId)}` : null;
  const className = "text-xs font-bold leading-5 text-[#0B302B] [overflow-wrap:anywhere]";
  return href ? <Link href={href} className={`${className} underline decoration-[#71548D]/25 underline-offset-4`}><SponsorObjectiveName objective={objective} /></Link>
    : <p className={className}><SponsorObjectiveName objective={objective} /></p>;
}

function ObjectiveProgress({ objective, en }: { objective: SponsorContractObjective; en: boolean }) {
  const progress = getSponsorObjectiveProgressDisplay({ targetDetails: objective.targetDetails, currentValue: objective.currentValue, persistedTargetValue: objective.targetValue });
  const status = getSponsorObjectiveStatusPresentation(objective.status, objective.achievementLevel);
  const labels = { achieved: "Achieved", partial: "Partial success", failed: "Not achieved", neutralized: "Neutralised", in_progress: "In progress" };
  const number = new Intl.NumberFormat(en ? "en-GB" : "fr-FR", { maximumFractionDigits: 1 });
  return <div className="mt-2 text-[11px] leading-5 text-[#60756E]">
    <p className={status.status === "achieved" ? "font-bold text-[#176951]" : "font-semibold"}>{en ? labels[status.status] : status.label}</p>
    {progress ? <>
      <p>{progress.label}{" : "}{number.format(progress.currentValue)}{progress.unit === "percentage" ? " %" : ""}{" / "}{number.format(progress.targetValue)}{progress.unit === "percentage" ? " %" : ""}</p>
      <div role="progressbar" aria-label={progress.label} aria-valuenow={progress.percentage} aria-valuemin={0} aria-valuemax={100} className="mt-1 h-1 overflow-hidden rounded-full bg-[#71548D]/10"><div className="h-full rounded-full bg-[#71548D]/60" style={{ width: `${progress.percentage}%` }} /></div>
    </> : null}
    <p>{en ? "Contractual weight: " : "Poids contractuel : "}{objective.satisfactionPoints} {en ? "pts" : "pts"}</p>
  </div>;
}

/** Used above registration/preparation and inside My team after the official finish. */
export function SponsorRaceBriefPanel({ brief, final = false }: { brief: SponsorRaceBrief | null; final?: boolean }) {
  const { locale } = useLocale(); const en = locale === "en";
  if (!brief) return null;
  return <aside data-sponsor-race-brief className="mb-4 min-w-0 rounded-xl border border-[#8970A9]/20 bg-[#FAF7FF] p-4">
    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#71548D]">{brief.objectives.length ? en ? "Contractual sponsor objective" : "Objectif contractuel du sponsor" : en ? "Sporting affinity" : "Affinité sportive"}</p>
    <p className="mt-1 text-xs font-semibold leading-5 text-[#60756E]"><span data-i18n-skip>{brief.sponsorName}</span>{" · "}{brief.scope === "general" ? en ? "General classification of the tour" : "Classement général du tour" : brief.scope === "stages" ? en ? "Relevant stages only" : "Étapes concernées uniquement" : en ? "Race result" : "Résultat de la course"}</p>
    {brief.objectives.length ? <ul className="mt-2 space-y-3">{brief.objectives.map(objective => <li key={objective.id}>
      <p className="text-sm font-bold leading-6 text-[#0B302B] [overflow-wrap:anywhere]"><SponsorObjectiveName objective={objective} /></p>
      {final ? <p className="mt-1 text-xs font-bold text-[#71548D]">{objective.status === "completed" ? en ? "Objective achieved" : "Objectif atteint"
        : objective.status === "failed" ? objective.achievementLevel === "partial" ? en ? "Partial success recorded" : "Réussite partielle enregistrée" : en ? "Objective not achieved" : "Objectif non atteint"
          : en ? "Results published — sponsor assessment pending." : "Résultats publiés — évaluation sponsor en attente."}</p>
        : brief.scope === "general" ? <p className="mt-1 text-xs leading-5 text-[#60756E]">{en ? "Assessed at the end of the tour, not after each stage." : "Évalué à la fin du tour, pas après chaque étape."}</p> : null}
      <p className="mt-1 text-xs text-[#60756E]">{en ? "Contractual weight: " : "Poids contractuel : "}{objective.satisfactionPoints} {en ? "satisfaction points" : "points de satisfaction"}</p>
      {final && objective.status === "failed" && objective.achievementLevel === "partial" && objective.partialSatisfactionPoints > 0 ? <p className="mt-1 text-xs font-bold text-[#A96924]">{en ? "Partial objective points recorded: " : "Points d’objectif partiels enregistrés : "}{objective.partialSatisfactionPoints}</p> : null}
      {!final && objective.status === "active" && objective.mainObjectiveTerms?.settlementStatus === "pending" ? <SponsorMainObjectiveTermsCard terms={objective.mainObjectiveTerms} compact /> : null}
    </li>)}</ul> : <p className="mt-2 text-xs leading-5 text-[#60756E]">{en ? "This profile matches the partner's philosophy. Affinity alone adds no contractual reward." : "Ce profil correspond à la philosophie du partenaire. L’affinité seule n’ajoute aucune récompense contractuelle."}</p>}
    {brief.objectives.length ? <p className="mt-2 text-[10px] leading-5 text-[#72847E]">{en ? "Objective points before bonuses; total satisfaction remains capped at 100." : "Points d’objectif avant bonus ; la satisfaction totale reste plafonnée à 100."}</p> : null}
  </aside>;
}
