import type { LockedOfficialStageSimulation } from "./official-race-simulation";
import type { RaceWeather } from "./race-weather";

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
  // Do not rebuild historical conditions with a potentially newer weather model.
  return input.weather ?? null;
}
