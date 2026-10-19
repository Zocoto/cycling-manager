"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import type { SponsorContractObjective } from "@/services/sponsoring-workflow";

/** Translate the signed target, not rider/race proper names or a newly generated goal. */
export function SponsorObjectiveName({ objective }: { objective: SponsorContractObjective }) {
  const { locale } = useLocale();
  if (locale !== "en") return <>{objective.name}</>;
  const target = objective.targetDetails;
  switch (target.kind) {
    case "race_result": return <>{target.achievementType === "win" ? target.requiredCount > 1 ? `${target.requiredCount} wins at ` : "Win at "
      : target.requiredCount > 1 ? `${target.requiredCount} Top ${target.targetRank} finishes at ` : `Top ${target.targetRank} at `}<span data-i18n-skip>{target.raceLabel}</span></>;
    case "nationality_quota": return <>Roster from {target.countryCode}: at least {target.minimumPercentage}%</>;
    case "season_wins": return <>{target.minimumWinCount} wins ({({ all: "all races", one_day_races: "one-day races", stages: "stages", stage_race_general: "general classifications" })[target.winScope]})</>;
    case "uci_ranking": return <>Team UCI ranking: Top {target.targetRank}</>;
    case "nation_uci_ranking": return <>UCI nations ranking: {target.countryCode} in the Top {target.targetRank}</>;
    case "national_championship": return <>{target.requiredTitleCount} national title(s) ({target.countryCode}, {target.championshipType === "any" ? "road or time trial" : target.championshipType === "road" ? "road" : "time trial"})</>;
    case "homegrown_roster": return <>At least {target.minimumPercentage}% homegrown riders</>;
    case "youth_development": return <>{({ promotions: "Youth promotions", development_roster: "Development team riders", junior_race_wins: "Junior wins", homegrown_sales: "Homegrown rider sales" })[target.metric]}: {target.minimumCount}</>;
    case "rider_recruitment": return <>Sign <span data-i18n-skip>{target.riderName}</span></>;
    case "infrastructure": return <>Completed infrastructure projects: {target.minimumCompletedCount}</>;
  }
}
