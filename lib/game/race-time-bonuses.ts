import type { RaceStageType } from "./race-calendar";
import type { StageSimulationResult } from "./race-simulation";

export const UCI_STAGE_FINISH_BONUS_SECONDS = [10, 6, 4] as const;
export const UCI_INTERMEDIATE_SPRINT_BONUS_SECONDS = [3, 2, 1] as const;

const MAX_INTERMEDIATE_SPRINTS_PER_STAGE = 3;

type TimeBonusSimulation = Pick<StageSimulationResult, "primes" | "results">;

/** Calcule les bonifications UCI d'une étape de tour. */
export function calculateStageRaceTimeBonuses({
  raceFormat,
  stageType,
  simulation,
}: {
  raceFormat: "one_day" | "stage_race";
  stageType: RaceStageType;
  simulation: TimeBonusSimulation;
}): Record<string, number> {
  if (raceFormat !== "stage_race" || stageType !== "road") return {};

  const bonusByRiderId: Record<string, number> = {};
  const award = (riderId: string, seconds: number | undefined) => {
    if (!seconds) return;
    bonusByRiderId[riderId] = (bonusByRiderId[riderId] ?? 0) + seconds;
  };

  for (const result of simulation.results) {
    if (result.status !== "finished" || result.rank === null) continue;
    award(result.riderId, UCI_STAGE_FINISH_BONUS_SECONDS[result.rank - 1]);
  }

  const intermediateSprints = simulation.primes
    .filter((primeResult) => primeResult.prime.type === "intermediate_sprint")
    .sort((first, second) => first.segmentNumber - second.segmentNumber)
    .slice(0, MAX_INTERMEDIATE_SPRINTS_PER_STAGE);

  for (const sprint of intermediateSprints) {
    for (const result of sprint.classification) {
      award(
        result.riderId,
        UCI_INTERMEDIATE_SPRINT_BONUS_SECONDS[result.rank - 1],
      );
    }
  }

  return bonusByRiderId;
}
