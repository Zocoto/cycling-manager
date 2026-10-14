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
  let crashes = 0;
  let finalSprintCrashes = 0;
  let climbCrashes = 0;
  let injuredRiders = 0;

  for (let seed = 1; seed <= sampleSize; seed += 1) {
    const input = createDemoSimulationInput(scenario.id, seed);
    const simulation = simulateRaceStage(input);
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
    // An incident can remain visible in several interpolated replay frames.
    const uniqueIncidents = [...new Map(simulation.timeline.flatMap(
      (snapshot) => snapshot.incidents.map((incident) => [incident.id, incident] as const),
    )).values()];
    incidents += uniqueIncidents.length;
    const crashIncidents = uniqueIncidents.filter(
      (incident) => incident.type === "crash_individual" || incident.type === "crash_mass",
    );
    crashes += crashIncidents.length;
    const segmentNumberByIncidentId = new Map(simulation.timeline.flatMap(
      (snapshot) => snapshot.incidents.map((incident) => [incident.id, snapshot.segmentNumber] as const),
    ));
    climbCrashes += crashIncidents.filter(
      (incident) => input.segments[(segmentNumberByIncidentId.get(incident.id) ?? 0) - 1]?.terrain === "climb",
    ).length;
    finalSprintCrashes += finalSnapshot?.incidents.filter(
      (incident) => incident.type === "crash_mass",
    ).length ?? 0;
    injuredRiders += simulation.results.filter(
      (result) => result.injury !== null,
    ).length;
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
    averageCrashes: round(crashes / sampleSize),
    averageInjuredRiders: round(injuredRiders / sampleSize),
    finalSprintCrashRatePct: round(finalSprintCrashes / sampleSize * 100),
    climbCrashes,
    averageAbandonments: round(abandonments / sampleSize),
  };
});

console.table(rows);

function round(value: number) {
  return Math.round(value * 100) / 100;
}
