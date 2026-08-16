import type { RaceCategoryCode } from "./race-calendar";

export const REGIONAL_RACE_CONTINENT_CODES = [
  "africa",
  "america",
  "asia",
  "europe",
  "oceania",
] as const;

export type RegionalRaceContinentCode =
  (typeof REGIONAL_RACE_CONTINENT_CODES)[number];

export type RegionalRaceAccessContext = {
  isAmateur: boolean;
  teamContinentCode: string | null;
};

export function canTeamAccessRaceCategory({
  categoryCode,
  raceContinentCode,
  context,
}: {
  categoryCode: RaceCategoryCode;
  raceContinentCode: string | null;
  context: RegionalRaceAccessContext | null;
}) {
  if (categoryCode !== "regional") return true;

  return Boolean(
    context?.isAmateur &&
      context.teamContinentCode &&
      raceContinentCode &&
      context.teamContinentCode === raceContinentCode,
  );
}
