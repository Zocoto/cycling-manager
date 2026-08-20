import {
  RACE_DEMO_SCENARIOS,
  createDemoSimulationInput,
} from "../lib/game/race-simulation-demo";
import { simulateRaceStage } from "../lib/game/race-simulation";

const requestedSample = process.argv
  .find((argument) => argument.startsWith("--samples="))
  ?.split("=")[1];
const sampleSize = Math.max(10, Number.parseInt(requestedSample ?? "100", 10));
const roadScenarios = RACE_DEMO_SCENARIOS.filter(
  (scenario) => scenario.stageType === "road",
);

const rows = roadScenarios.map((scenario) => {
  const winnerCounts = new Map<string, number>();
  let breakawayWins = 0;
  let finishGroups = 0;
  let incidents = 0;
  let abandonments = 0;

  for (let seed = 1; seed <= sampleSize; seed += 1) {
    const simulation = simulateRaceStage(
      createDemoSimulationInput(scenario.id, seed),
    );
    const winnerId = simulation.results.find((result) => result.rank === 1)
      ?.riderId;
    if (winnerId) {
      winnerCounts.set(winnerId, (winnerCounts.get(winnerId) ?? 0) + 1);
    }

    const finalSnapshot = simulation.timeline.at(-1);
    if (finalSnapshot?.groups[0]?.type === "breakaway") {
      breakawayWins += 1;
    }
    finishGroups += finalSnapshot?.groups.length ?? 0;
    incidents += simulation.timeline.reduce(
      (total, snapshot) => total + snapshot.incidents.length,
      0,
    );
    abandonments += simulation.results.filter(
      (result) => result.status === "did_not_finish",
    ).length;
  }

  const favoriteWinCount = Math.max(0, ...winnerCounts.values());
  return {
    scenario: scenario.id,
    samples: sampleSize,
    uniqueWinners: winnerCounts.size,
    favoriteWinRatePct: round((favoriteWinCount / sampleSize) * 100),
    breakawayWinRatePct: round((breakawayWins / sampleSize) * 100),
    averageFinishGroups: round(finishGroups / sampleSize),
    averageIncidents: round(incidents / sampleSize),
    averageAbandonments: round(abandonments / sampleSize),
  };
});

console.table(rows);

function round(value: number) {
  return Math.round(value * 100) / 100;
}
