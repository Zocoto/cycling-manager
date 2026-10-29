import { getDivisionForRank, type TeamDivisionCode } from "@/lib/game/economy";
import type { RaceCategoryCode, RaceProfileType } from "@/lib/game/race-calendar";
import type { RiderRatings } from "@/lib/game/rider-profile";
import type { SponsorObjectiveDifficulty } from "@/lib/game/sponsor-negotiation";
import type { SponsorObjectiveAmbitionLevel } from "@/types/sponsor-objective";

export type SponsorObjectiveSportingContext = {
  currentDivision: TeamDivisionCode | null;
  projectedDivision: TeamDivisionCode | null;
  projectedRank: number | null;
};

export type SponsorObjectiveSportingLevel = Readonly<{
  categoryPriorities: readonly (readonly RaceCategoryCode[])[];
  teamStrength: number | null;
  teamAmbition: SponsorObjectiveAmbitionLevel | null;
  projectedRank: number | null;
  division: TeamDivisionCode;
}>;

type ObjectiveRace = {
  categoryCode?: RaceCategoryCode;
  raceFormat?: "one_day" | "stage_race";
  profileTypes?: readonly RaceProfileType[];
  isGrandTour?: boolean;
};

const DIVISIONS: readonly TeamDivisionCode[] = ["amateur", "national", "continental", "world", "elite"];
const PRIMARY_KEYS = ["mountain", "hills", "flat", "timeTrial", "cobbles", "sprint"] as const;
const REQUIRED_KEYS = [...PRIMARY_KEYS, "endurance", "resistance", "recovery"] as const;
const CATEGORY_PRIORITIES: Record<TeamDivisionCode, readonly (readonly RaceCategoryCode[])[]> = {
  // A strong non-Elite roster does not guarantee a wildcard. Elite is omitted,
  // including from fallback bands, until the team has Elite sporting status.
  elite: [["elite"], ["world"], ["continental"], ["national"]],
  world: [["world"], ["continental"], ["national"]],
  continental: [["continental"], ["national"], ["world"]],
  national: [["national"], ["continental"], ["world"]],
  amateur: [["national"], ["continental"], ["world"]],
};
const DIVISION_RANK_BASELINE: Record<TeamDivisionCode, number> = {
  elite: 15, world: 40, continental: 80, national: 150, amateur: 220,
};
const WINNER_STRENGTH: Partial<Record<RaceCategoryCode, number>> = {
  national: 66, continental: 71, world: 76, elite: 81,
};

export function resolveSponsorObjectiveSportingLevel({
  context,
  ratings,
}: {
  context: SponsorObjectiveSportingContext | undefined;
  ratings: readonly RiderRatings[];
}): SponsorObjectiveSportingLevel | null {
  const reliableRatings = ratings.filter(isReliableRating);
  const projectedRank = positiveInteger(context?.projectedRank);
  const currentDivision = readDivision(context?.currentDivision);
  const projectedDivision = readDivision(context?.projectedDivision)
    ?? (projectedRank === null ? null : getDivisionForRank(projectedRank));
  if (reliableRatings.length === 0 && currentDivision === null && projectedDivision === null) return null;

  // Specialists are judged on their strongest native primary skill, rather than
  // the average of all thirteen attributes. Top-three/top-six means incorporate
  // known roster depth without inventing zero-rated riders for missing data.
  const teamStrength = reliableRatings.length === 0 ? null : round(
    aggregateDepth(reliableRatings.map((rider) =>
      Math.max(...PRIMARY_KEYS.map((key) => rider[key])) * 0.7
        + (rider.endurance + rider.resistance + rider.recovery) / 3 * 0.3,
    )),
  );
  let division: TeamDivisionCode = projectedDivision ?? currentDivision ?? "amateur";
  // A known next-season projection takes precedence, including a relegation.
  // Current Elite status is a fallback only while that projection is unknown.
  if (division !== "elite" && teamStrength !== null) {
    const strengthDivision: TeamDivisionCode = teamStrength >= 70 ? "world"
      : teamStrength >= 64 ? "continental" : "national";
    if (DIVISIONS.indexOf(strengthDivision) > DIVISIONS.indexOf(division)) division = strengthDivision;
  }

  return {
    categoryPriorities: CATEGORY_PRIORITIES[division],
    teamStrength,
    teamAmbition: teamStrength === null ? null : ambitionForStrength(teamStrength),
    projectedRank,
    division,
  };
}

export function getSponsorObjectiveRaceMinimumRank({
  race,
  ratings,
  difficulty,
}: {
  race: ObjectiveRace;
  ratings: readonly RiderRatings[];
  difficulty: SponsorObjectiveDifficulty;
}): number | null {
  const reference = race.categoryCode === undefined ? undefined : WINNER_STRENGTH[race.categoryCode];
  const reliableRatings = ratings.filter(isReliableRating);
  if (reference === undefined || reliableRatings.length === 0) return null;
  const scores = reliableRatings.map((rider) => raceStrength(rider, race)).sort((left, right) => right - left);
  // One-day results can be carried by a specialist. A tour's general classification
  // requires more collective depth; one sprint/TT stage never defines its GC.
  const score = race.raceFormat === "stage_race" || race.isGrandTour === true
    ? scores[0] * 0.55 + mean(scores.slice(0, 3)) * 0.25 + mean(scores.slice(0, 6)) * 0.2
    : scores[0] * 0.85 + mean(scores.slice(0, 3)) * 0.15;
  const gap = Math.round((reference - score) * 1_000_000) / 1_000_000;
  const baseline = gap <= -2 ? 1 : gap <= 1 ? 3 : gap <= 4 ? 5
    : gap <= 7 ? 10 : gap <= 10 ? 15 : gap <= 14 ? 20 : 25;
  // Move an actual result tier, not a rating point that may stay in the same
  // bucket. A victory remains the strongest possible single-race requirement.
  const ranks = [1, 3, 5, 10, 15, 20, 25, 30];
  const index = ranks.indexOf(baseline) + difficultyOffset(difficulty);
  return ranks[Math.max(0, Math.min(ranks.length - 1, index))];
}

export function getSponsorObjectiveUciTargetRank({
  requestedRank,
  context,
  difficulty,
}: {
  requestedRank: number;
  context: SponsorObjectiveSportingContext | undefined;
  difficulty: SponsorObjectiveDifficulty;
}): number {
  const requested = positiveInteger(requestedRank) ?? 1;
  const division = readDivision(context?.projectedDivision) ?? readDivision(context?.currentDivision);
  const baseline = positiveInteger(context?.projectedRank)
    ?? (division === null ? null : DIVISION_RANK_BASELINE[division]);
  if (baseline === null) return requested;
  // Keep ambitions close to the team's provisional standing; a small negotiation
  // adjustment cannot turn a projected rank 150 into an expectation of rank 30.
  const margin = Math.max(5, Math.round(baseline * 0.12));
  const offset = difficultyOffset(difficulty) * Math.max(2, Math.round(baseline * 0.04));
  const center = Math.max(1, baseline + offset);
  return Math.max(1, Math.max(center - margin, Math.min(center + margin, requested)));
}

export function getSponsorObjectiveWinCount({
  requestedCount,
  teamStrength,
  difficulty,
}: {
  requestedCount: number;
  teamStrength: number | null;
  difficulty: SponsorObjectiveDifficulty;
}): number {
  const requested = positiveInteger(requestedCount) ?? 1;
  if (!isRatingValue(teamStrength)) return requested;
  const ceilings: Record<SponsorObjectiveAmbitionLevel, number> = {
    1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12,
  };
  const ceiling = ceilings[ambitionForStrength(teamStrength)];
  const baseline = Math.min(requested, ceiling);
  // Preserve the calibrated balanced target and make negotiation visible even
  // at ambition level 6. One additional win, never an unbounded new quota.
  return Math.max(1, baseline - difficultyOffset(difficulty));
}

function raceStrength(rider: RiderRatings, race: ObjectiveRace): number {
  const profiles = new Set(race.profileTypes ?? []);
  const tour = race.raceFormat === "stage_race" || race.isGrandTour === true;
  let primary: number;
  if (tour) {
    if (race.isGrandTour === true || profiles.has("mountain")) {
      primary = rider.mountain * 0.5 + rider.timeTrial * 0.25 + rider.hills * 0.15 + rider.flat * 0.1;
    } else if (profiles.has("hilly")) {
      primary = rider.hills * 0.5 + rider.timeTrial * 0.25 + rider.flat * 0.15 + rider.sprint * 0.1;
    } else if (profiles.has("time_trial")) {
      primary = rider.timeTrial * 0.7 + rider.flat * 0.2 + rider.sprint * 0.1;
    } else if (profiles.has("flat") || profiles.has("sprint")) {
      primary = rider.sprint * 0.55 + rider.flat * 0.3 + rider.timeTrial * 0.15;
    } else {
      primary = rider.mountain * 0.5 + rider.timeTrial * 0.3 + rider.hills * 0.2;
    }
    return primary * 0.7 + (rider.recovery * 0.5 + rider.endurance * 0.3 + rider.resistance * 0.2) * 0.3;
  }
  if (profiles.has("mountain")) primary = rider.mountain;
  else if (profiles.has("hilly")) primary = rider.hills;
  else if (profiles.has("cobbles")) primary = rider.cobbles;
  else if (profiles.has("time_trial")) primary = rider.timeTrial;
  else if (profiles.has("sprint") || profiles.has("flat")) primary = rider.sprint;
  else primary = Math.max(...PRIMARY_KEYS.map((key) => rider[key]));
  return primary * 0.7 + (rider.endurance + rider.resistance) / 2 * 0.3;
}

function aggregateDepth(scores: readonly number[]): number {
  const ordered = [...scores].sort((left, right) => right - left);
  return mean(ordered.slice(0, 3)) * 0.55 + mean(ordered.slice(0, 6)) * 0.45;
}

function ambitionForStrength(strength: number): SponsorObjectiveAmbitionLevel {
  if (strength >= 82) return 6;
  if (strength >= 76) return 5;
  if (strength >= 70) return 4;
  if (strength >= 64) return 3;
  if (strength >= 58) return 2;
  return 1;
}

function difficultyOffset(difficulty: SponsorObjectiveDifficulty): -1 | 0 | 1 {
  return difficulty === "accessible" ? 1 : difficulty === "ambitious" ? -1 : 0;
}

function readDivision(value: TeamDivisionCode | null | undefined): TeamDivisionCode | null {
  return value !== null && value !== undefined && DIVISIONS.includes(value) ? value : null;
}

function positiveInteger(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 1
    ? Math.floor(value) : null;
}

function isRatingValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isReliableRating(rider: RiderRatings): boolean {
  return rider !== null && typeof rider === "object"
    && REQUIRED_KEYS.every((key) => isRatingValue(rider[key]))
    && REQUIRED_KEYS.some((key) => rider[key] > 0);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
