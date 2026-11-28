import type { SponsorObjectiveTargetDetails } from "@/types/sponsor-objective";
import type { RaceCategoryCode } from "@/lib/game/race-calendar";
import type { SponsorSportingPhilosophy } from "@/lib/game/sponsor-philosophy";

const RACE_CATEGORY_DIFFICULTY: Record<RaceCategoryCode, number> = {
  local: 1, regional: 1, national: 1, continental: 1.2, world: 1.4, elite: 1.6,
};

const RACE_VISIBILITY_DIFFICULTY = {
  classic_breakaways: { base: 7, perResult: 1.5 },
  stage_breakaways: { base: 7, perResult: 1.2 },
  combativity_awards: { base: 10, perResult: 4 },
} as const;

/** A requirement's family and final target determine its weight, never its slot. */
export function getSponsorObjectiveDifficultyWeight(
  details: SponsorObjectiveTargetDetails,
  options: { raceCategoryCode?: RaceCategoryCode; sportingPhilosophy?: SponsorSportingPhilosophy } = {},
): number {
  let weight: number;
  switch (details.kind) {
    case "race_result": {
      const rank = details.achievementType === "win" ? 1 : Math.max(1, details.targetRank ?? 1);
      weight = 8 * (1 + 1 / Math.sqrt(rank)) * Math.max(1, details.requiredCount)
        * RACE_CATEGORY_DIFFICULTY[options.raceCategoryCode ?? "national"];
      break;
    }
    case "season_wins":
      weight = (6 + 2 * details.minimumWinCount) * (details.winScope === "all" ? .9 : details.winScope === "stage_race_general" ? 1.15 : 1);
      break;
    case "nationality_quota": weight = 5 + details.minimumPercentage / 5; break;
    case "homegrown_roster": weight = 5 + details.minimumPercentage / 3; break;
    case "uci_ranking": {
      const rank = Math.max(1, details.targetRank);
      const expectedRank = details.sportingCalibration?.projectedRank;
      const relativeDifficulty = expectedRank && expectedRank > 0
        ? Math.max(.85, Math.min(1.15, Math.sqrt(expectedRank / rank))) : 1;
      weight = (5 + 15 / Math.sqrt(rank)) * relativeDifficulty;
      break;
    }
    case "nation_uci_ranking": weight = 5 + 12 / Math.sqrt(Math.max(1, details.targetRank)); break;
    case "national_championship":
      weight = (7 + 3 * details.requiredTitleCount) * (details.championshipType === "any" ? .9 : 1);
      break;
    case "youth_development":
      weight = details.metric === "development_roster" ? 4 + details.minimumCount : 5 + 3 * details.minimumCount;
      break;
    case "race_visibility": {
      const { base, perResult } = RACE_VISIBILITY_DIFFICULTY[details.metric];
      weight = base + perResult * details.minimumCount;
      break;
    }
    case "rider_recruitment": weight = 5 + Math.max(0, details.overallRating - 45) / 3; break;
    case "infrastructure": weight = 5 + 3 * details.minimumCompletedCount; break;
  }
  const philosophy = options.sportingPhilosophy ?? details.sportingPhilosophy;
  const aligned = philosophy === "visibility" && details.kind === "race_visibility" || (philosophy === "national_preference"
    ? ["nationality_quota", "national_championship", "nation_uci_ranking"].includes(details.kind)
    : philosophy === "youth_development"
      ? details.kind === "youth_development" || details.kind === "homegrown_roster"
      : details.kind === "season_wins" && (
        (philosophy === "cobbled_classics" || philosophy === "ardennes_classics") && details.winScope === "one_day_races"
        || (philosophy === "medium_stage_races" || philosophy === "grand_tour_general") && ["stages", "stage_race_general"].includes(details.winScope)
        || philosophy === "time_trials" && details.winScope === "stages"
        || philosophy === "sprints" && ["stages", "one_day_races"].includes(details.winScope)
      ));
  return weight * (aligned ? 1.15 : 1);
}

/** Largest remainders preserve a fixed budget and monotonic comparable weights. */
export function allocateSponsorObjectiveSatisfactionPoints(
  targets: readonly SponsorObjectiveTargetDetails[],
  options: { raceCategories?: ReadonlyMap<string, RaceCategoryCode>; sportingPhilosophy?: SponsorSportingPhilosophy } = {},
): number[] {
  if (!targets.length || targets.length > 100) throw new Error("Le nombre d’objectifs sponsor est invalide.");
  const weights = targets.map(details => getSponsorObjectiveDifficultyWeight(details, {
    ...(details.kind === "race_result" ? { raceCategoryCode: options.raceCategories?.get(details.raceId) } : {}),
    sportingPhilosophy: options.sportingPhilosophy,
  }));
  if (weights.some(weight => !Number.isFinite(weight) || weight <= 0)) throw new Error("La difficulté des objectifs sponsor est invalide.");
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const portions = weights.map((weight, index) => ({ index, exact: weight / total * (100 - targets.length), weight }));
  const points = portions.map(portion => 1 + Math.floor(portion.exact));
  const remainder = 100 - points.reduce((sum, point) => sum + point, 0);
  const order = [...portions].sort((first, second) =>
    (second.exact % 1) - (first.exact % 1) || second.weight - first.weight || first.index - second.index);
  for (let index = 0; index < remainder; index++) points[order[index].index]++;
  return points;
}

/** The counter or sporting result being requested, independently of its target. */
export function getSponsorObjectiveRequirementKey(details: SponsorObjectiveTargetDetails): string {
  switch (details.kind) {
    case "race_result": return `race:${details.raceId}`;
    case "season_wins": return `wins:${details.winScope}`;
    case "nationality_quota": return `nationality:${details.countryCode.toUpperCase()}`;
    case "uci_ranking": return `ranking:${details.rankingScope}`;
    case "nation_uci_ranking": return `nation:${details.countryCode.toUpperCase()}`;
    case "national_championship": return `championship:${details.countryCode.toUpperCase()}:${details.championshipType}`;
    case "homegrown_roster": return "homegrown";
    case "youth_development": return `youth:${details.metric}`;
    case "race_visibility": return `visibility:${details.metric}`;
    case "rider_recruitment": return `recruitment:${details.riderId}`;
    case "infrastructure": return "infrastructure";
  }
}

/** Nested thresholds on the same counter are a single commitment, not two goals. */
export function haveOverlappingSponsorObjectiveRequirements(
  first: SponsorObjectiveTargetDetails,
  second: SponsorObjectiveTargetDetails,
): boolean {
  if (getSponsorObjectiveRequirementKey(first) === getSponsorObjectiveRequirementKey(second)) return true;
  if (first.kind === "season_wins" && second.kind === "season_wins") {
    return first.winScope === "all" || second.winScope === "all";
  }
  return first.kind === "national_championship" && second.kind === "national_championship"
    && first.countryCode.toUpperCase() === second.countryCode.toUpperCase()
    && (first.championshipType === "any" || second.championshipType === "any");
}

export function assertSponsorObjectivePlanConsistency(
  objectives: readonly { targetDetails: SponsorObjectiveTargetDetails; satisfactionPoints: number }[],
): void {
  if (objectives.length !== 10 || objectives.some(objective => !Number.isInteger(objective.satisfactionPoints) || objective.satisfactionPoints <= 0)
    || objectives.reduce((total, objective) => total + objective.satisfactionPoints, 0) !== 100) {
    throw new Error("Le plan sponsor doit contenir dix objectifs totalisant 100 points de satisfaction.");
  }
  for (let index = 0; index < objectives.length; index++) {
    if (objectives.slice(index + 1).some(other => haveOverlappingSponsorObjectiveRequirements(objectives[index].targetDetails, other.targetDetails))) {
      throw new Error("Les objectifs sponsor ne doivent pas contenir deux engagements équivalents ou imbriqués.");
    }
  }
}
