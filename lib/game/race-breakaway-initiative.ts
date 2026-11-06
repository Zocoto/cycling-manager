import type {
  RaceCollectivePosture,
  RaceStrategyObjective,
} from "./race-strategy";

export const MAX_DOMESTIQUE_BREAKAWAY_INITIATIVE_CHANCE = 0.2;

export type DomestiqueBreakawayInitiativeContext = {
  breakawayRating: number;
  form: number;
  favoriteRaceBonus?: number;
  riderCountryCode?: string | null;
  raceCountryCode?: string | null;
  hasPanache?: boolean;
  collectivePosture?: RaceCollectivePosture;
  objective?: RaceStrategyObjective;
  favoriteTier?: "major" | "medium" | "none";
};

/** Chance of one spontaneous initiative, sampled once per team by the engine. */
export function getDomestiqueBreakawayInitiativeChance({
  breakawayRating,
  form,
  favoriteRaceBonus,
  riderCountryCode,
  raceCountryCode,
  hasPanache,
  collectivePosture,
  objective,
  favoriteTier,
}: DomestiqueBreakawayInitiativeContext): number {
  if (!Number.isFinite(breakawayRating) || !Number.isFinite(form)) return 0;

  const riderCountry = riderCountryCode?.trim().toUpperCase() ?? "";
  const raceCountry = raceCountryCode?.trim().toUpperCase() ?? "";
  const racingAtHome =
    /^[A-Z]{2}$/.test(riderCountry) && riderCountry === raceCountry;
  const favoriteMotivation =
    Number.isFinite(favoriteRaceBonus) && (favoriteRaceBonus ?? 0) > 0;
  const motivation =
    0.025 +
    clamp((breakawayRating - 68) / 22, 0, 1) * 0.075 +
    (favoriteMotivation ? 0.045 : 0) +
    (racingAtHome ? 0.035 : 0) +
    (hasPanache ? 0.02 : 0);
  const formFactor = clamp((form - 45) / 40, 0, 1);
  const postureFactor =
    collectivePosture === "conservative"
      ? 0.5
      : collectivePosture === "aggressive"
        ? 1.2
        : 1;
  const objectiveFactor =
    objective === "sprint" || objective === "general_classification" ? 0.5 : 1;
  const teamFactor =
    favoriteTier === "major" ? 0.4 : favoriteTier === "medium" ? 0.7 : 1;

  return clamp(
    motivation * formFactor * postureFactor * objectiveFactor * teamFactor,
    0,
    MAX_DOMESTIQUE_BREAKAWAY_INITIATIVE_CHANCE,
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
