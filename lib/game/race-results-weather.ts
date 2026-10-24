import type { LockedOfficialStageSimulation } from "./official-race-simulation";
import { getRaceWeather, type RaceWeather } from "./race-weather";

/** Read the weather used by the engine, never today's forecast or another stage. */
export function getRaceResultsWeather({
  raceEditionId,
  stageId,
  lockedSimulation,
}: {
  raceEditionId: string;
  stageId: string;
  lockedSimulation?: Pick<LockedOfficialStageSimulation, "raceEditionId" | "stageId" | "input"> | null;
}): RaceWeather | null {
  if (
    !lockedSimulation ||
    lockedSimulation.raceEditionId !== raceEditionId ||
    lockedSimulation.stageId !== stageId
  ) return null;

  const { input } = lockedSimulation;
  // Legacy inputs without explicit weather use the same fallback as the engine.
  return input.weather ?? getRaceWeather(input.seed, {
    countryCode: input.raceCountryCode,
    profileType: input.profileType,
  });
}
