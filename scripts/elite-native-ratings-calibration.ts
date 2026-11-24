// Local deterministic comparison only. No database, player or scheduled race is touched.
// Usage: node node_modules/tsx/dist/cli.mjs scripts/elite-native-ratings-calibration.ts
// Optional: --baseline <git-ref> --seeds <1..100> --road-seeds <1..20> --output <local-json-file>
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

import { getEliteNativeRatingPremium } from "../lib/game/elite-native-ratings";
import { simulateRaceStage, type RiderSimulationInput, type RiderSimulationRatings, type StageSimulationInput } from "../lib/game/race-simulation";
import type { RaceStageSegment } from "../lib/game/race-profiles";
import type { RaceWeather } from "../lib/game/race-weather";

const args = process.argv.slice(2);
const option = (name: string, fallback?: string) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
// The last production revision before the native-rating premium was introduced.
const baselineRevision = option("--baseline", "46f19feaa490e081081314240b206ed03682c7be")!;
const seedCount = Number(option("--seeds", "50"));
if (!Number.isInteger(seedCount) || seedCount < 1 || seedCount > 100) throw new Error("Use between 1 and 100 deterministic seeds.");
const roadSeedCount = Number(option("--road-seeds", "5"));
if (!Number.isInteger(roadSeedCount) || roadSeedCount < 1 || roadSeedCount > 20) throw new Error("Use between 1 and 20 deterministic road seeds.");
const outputPath = option("--output");
const temporarySuffix = `.elite-calibration-${process.pid}-${Date.now()}`;
const baselineEngineName = `race-simulation${temporarySuffix}.ts`;
const baselineFavoritesName = `race-favorites${temporarySuffix}.ts`;
const baselineEnginePath = path.resolve("lib/game", baselineEngineName);
const baselineFavoritesPath = path.resolve("lib/game", baselineFavoritesName);
const gitFile = (file: string) => execFileSync("git", ["show", `${baselineRevision}:${file}`], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });

const baseRatings: RiderSimulationRatings = {
  flat: 75, mountain: 75, hills: 75, cobbles: 75, downhill: 75,
  sprint: 75, acceleration: 75, timeTrial: 75, prologue: 75,
  endurance: 75, resistance: 75, recovery: 75, breakaway: 75,
};
const neutralWeather: RaceWeather = {
  condition: "clear", rainIntensity: "none", temperatureC: 18,
  windSpeedKph: 0, windDirection: "headwind", windIntensity: "calm", isWet: false,
};
const segment = (distanceKm: number, terrain: RaceStageSegment["terrain"], averageGradientPct = 0,
  surface: RaceStageSegment["surface"] = "asphalt"): RaceStageSegment => ({
  segmentNumber: 0, distanceKm, terrain, averageGradientPct, surface, prime: null,
});
type Scenario = {
  id: string;
  profileType: StageSimulationInput["profileType"];
  stageType: StageSimulationInput["stageType"];
  primary: keyof RiderSimulationRatings;
  segments: RaceStageSegment[];
};
const scenarios: Scenario[] = [
  { id: "flat-itt-40km", profileType: "time_trial", stageType: "individual_time_trial", primary: "timeTrial",
    segments: Array.from({ length: 4 }, () => segment(10, "flat")) },
  { id: "summit-road-60km", profileType: "mountain", stageType: "road", primary: "mountain",
    segments: [segment(20, "flat"), segment(20, "climb", 8), segment(8, "descent", -6), segment(12, "climb", 10)] },
  { id: "sprint-road-60km", profileType: "sprint", stageType: "road", primary: "sprint",
    segments: Array.from({ length: 6 }, () => segment(10, "flat")) },
  { id: "cobbled-road-60km", profileType: "cobbles", stageType: "road", primary: "cobbles",
    segments: [segment(10, "flat"), segment(10, "flat", 0, "cobbles"), segment(6, "climb", 6, "cobbles"),
      segment(8, "descent", -5), segment(10, "flat", 0, "cobbles"), segment(6, "climb", 6, "cobbles"), segment(10, "flat", 0, "cobbles")] },
];
function rider(id: string, primary: keyof RiderSimulationRatings, rating: number, sprint: boolean): RiderSimulationInput {
  return {
    id, name: id, teamId: id, teamName: id, teamPrimaryColor: "#214c3e", teamSecondaryColor: "#e9d7a3",
    age: 25, form: 100, morale: 70, careerRaceDays: 0, role: sprint ? "sprinter" : "leader",
    climateProfile: { strength: "snow", weakness: "storm" }, ratings: { ...baseRatings, [primary]: rating },
  };
}
function inputFor(scenario: Scenario, low: number, seed: number) {
  // Alternate the stronger rider's ID and input position to balance seeded identity effects.
  const highId = seed % 2 ? "rider-a" : "rider-b";
  const lowId = highId === "rider-a" ? "rider-b" : "rider-a";
  const sprint = scenario.profileType === "sprint";
  const input: StageSimulationInput = {
    id: scenario.id, name: "Isolated native rating calibration", seed: `elite-native-${seed}`,
    stageType: scenario.stageType, profileType: scenario.profileType, isStageRace: false,
    weather: neutralWeather,
    segments: scenario.segments.map((row, index) => ({ ...row, segmentNumber: index + 1 })),
    riders: [
      rider("rider-a", scenario.primary, highId === "rider-a" ? low + 1 : low, sprint),
      rider("rider-b", scenario.primary, highId === "rider-b" ? low + 1 : low, sprint),
      ...Array.from({ length: 4 }, (_, index) => rider(`control-${index}`, scenario.primary, 70, sprint)),
    ],
  };
  return { input, highId, lowId };
}
function pairResult(result: ReturnType<typeof simulateRaceStage>, lowId: string, highId: string) {
  const low = result.results.find(row => row.riderId === lowId)!;
  const high = result.results.find(row => row.riderId === highId)!;
  return {
    gap: low.elapsedTimeSeconds - high.elapsedTimeSeconds,
    valid: low.status === "finished" && high.status === "finished",
    beatsLower: high.rank !== null && low.rank !== null && high.rank < low.rank,
    wins: high.rank === 1,
  };
}
const rounded = (value: number) => Math.round(value * 1_000) / 1_000;

async function main() {
  // Keep both baseline modules local so the old automatic hierarchy does not import
  // the current favorites curve. Type-only imports from the current engine erase.
  try {
    await writeFile(baselineFavoritesPath, gitFile("lib/game/race-favorites.ts"), "utf8");
    await writeFile(baselineEnginePath, gitFile("lib/game/race-simulation.ts")
      .replace('from "./race-favorites";', `from "./${baselineFavoritesName.slice(0, -3)}";`), "utf8");
    const baseline = await import(pathToFileURL(baselineEnginePath).href) as { simulateRaceStage: typeof simulateRaceStage };
    let unchangedSimulations = 0;
    let baselineMs = 0;
    let currentMs = 0;
    const comparisons = [];
    for (const scenario of scenarios) {
      const scenarioSeeds = scenario.stageType === "individual_time_trial" ? seedCount : roadSeedCount;
      for (const low of [74, 84, 85, 90, 95, 99]) {
        let changed = 0;
        let valid = 0;
        let previousGap = 0;
        let nextGap = 0;
        let previousWins = 0;
        let nextWins = 0;
        let previousBeatsLower = 0;
        let nextBeatsLower = 0;
        for (let seed = 0; seed < scenarioSeeds; seed++) {
          const { input, highId, lowId } = inputFor(scenario, low, seed);
          const before = performance.now();
          const oldResult = baseline.simulateRaceStage(input);
          baselineMs += performance.now() - before;
          const now = performance.now();
          const newResult = simulateRaceStage(input);
          currentMs += performance.now() - now;
          const identical = JSON.stringify(oldResult) === JSON.stringify(newResult);
          if (low + 1 <= 85) {
            assert(identical, `A field entirely below the threshold changed: ${scenario.id}, ${low}, seed ${seed}`);
            unchangedSimulations++;
          }
          changed += Number(!identical);
          const oldPair = pairResult(oldResult, lowId, highId);
          const newPair = pairResult(newResult, lowId, highId);
          previousWins += Number(oldPair.wins);
          nextWins += Number(newPair.wins);
          previousBeatsLower += Number(oldPair.beatsLower);
          nextBeatsLower += Number(newPair.beatsLower);
          if (oldPair.valid && newPair.valid) {
            valid++;
            previousGap += oldPair.gap;
            nextGap += newPair.gap;
          }
        }
        comparisons.push({ scenario: scenario.id, primary: scenario.primary, pair: `${low}/${low + 1}`,
          seeds: scenarioSeeds, validPairedFinishes: valid, changedSimulations: changed,
          before: { meanGapSeconds: valid ? rounded(previousGap / valid) : null, highWins: previousWins, highBeatsLower: previousBeatsLower },
          after: { meanGapSeconds: valid ? rounded(nextGap / valid) : null, highWins: nextWins, highBeatsLower: nextBeatsLower },
        });
      }
    }
    const report = {
      baselineRevision, seedCounts: { timeTrial: seedCount, road: roadSeedCount }, riderCount: 6,
      notes: "Synthetic seeded fixtures; six independent teams, identical form/morale and secondary ratings. Mean road gaps are observations of these fixtures, not seconds-per-rating promises.",
      nativeScale: [74, 75, 85, 86, 90, 91, 95, 96, 99, 100].map(native => ({
        native, premium: getEliteNativeRatingPremium(native), index: native + getEliteNativeRatingPremium(native),
      })),
      unchangedSimulations, runtimeMs: { baseline: rounded(baselineMs), current: rounded(currentMs) }, comparisons,
    };
    if (outputPath) {
      await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
      await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await rm(baselineEnginePath, { force: true });
    await rm(baselineFavoritesPath, { force: true });
  }
}
void main();
