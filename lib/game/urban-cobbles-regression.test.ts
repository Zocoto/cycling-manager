import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import type { RaceStageSegment } from "./race-profiles";
import { simulateRaceStage, type StageSimulationInput } from "./race-simulation";
import type { TimeTrialRiderPlan } from "./time-trial-preparation";

const SEEDS = [17, 41, 109] as const;
const SCENARIOS = [
  "sprint",
  "flat",
  "hilly",
  "mountain",
  "classic-cobbles",
  "individual-time-trial",
  "prologue",
  "team-time-trial",
  "non-urban-cobbled-finish",
  "uphill-finish",
] as const;
type Scenario = (typeof SCENARIOS)[number];

// Captured before the urban-circuit correction. Do not regenerate these when
// changing the finish algorithm: unrelated sporting outputs must stay exact.
const EXPECTED: Record<string, string> = {
  "sprint:17": "86ea4879b47454363231c17fb32f72e8f4c1d9a6a773040dfac2a4128eb23f73",
  "sprint:41": "3560642ea1ebec5804f69af5f573bee647f2b7bff4c803af178a95cad76cbe9f",
  "sprint:109": "60b2927b70db8aad92012e8ab29cadf2a413932b2fc13f6f3c172d559306665d",
  "flat:17": "86ea4879b47454363231c17fb32f72e8f4c1d9a6a773040dfac2a4128eb23f73",
  "flat:41": "3560642ea1ebec5804f69af5f573bee647f2b7bff4c803af178a95cad76cbe9f",
  "flat:109": "60b2927b70db8aad92012e8ab29cadf2a413932b2fc13f6f3c172d559306665d",
  "hilly:17": "dbddc29f6f10b3f7f92c35435a0a4240b185318c48e82fdcfb5e8b8826d3aed7",
  "hilly:41": "20eb3979e11bcd8f466bcb0aea3230d316d415328b6ed0c2edd76d2ad2d6c8a7",
  "hilly:109": "6e8d3c2ad42503370b75a620eb2ae5e575f09920d27c3ed47703f491b3e33cb2",
  "mountain:17": "9ef543f167852ec16eb8d31b03970260616cd01673a0f7b8622a2ac804c7ca48",
  "mountain:41": "e25156fba1587b0164ae02d9ff7416999e17f82e88f2c63337f8ad3819a0b41f",
  "mountain:109": "a831bbef69e2ba77560759ee8812d576df18f0b92be8d550be3c3d4b8598dbea",
  "classic-cobbles:17": "217c173636f6a5bf26825f17cd9b1aef6be40b7f07b8921edb43f4c51c31e20d",
  "classic-cobbles:41": "554a75898cb3d0e510730dd1f1351a55e2a356d2a66912e644872e9940b6bed9",
  "classic-cobbles:109": "456d73ddd35bb3e650cc2c812b281b642f6f4f2fab40e2d3e54fbe4ea0e68a99",
  "individual-time-trial:17": "46d2c814b54e51c05b99003ca1c312758878f77e715c5831d6cf2b9b2d838cc5",
  "individual-time-trial:41": "b79ea31a29f267fd184cd161e3bd49c659f9db6b44e6167f42e40b36be04431d",
  "individual-time-trial:109": "aadbe395380d8ef35dc3e809e544b39df228c4b8aaf169b11d6bf3dd326d952d",
  "prologue:17": "95764ddcb4f00eedf487a73a74154922f5dee418e6c3cd705ed4f70d29240e9d",
  "prologue:41": "0e56603ad05240c2dcbe61fab2a512083b7ae467399589d811743a62b5929bff",
  "prologue:109": "255287fbd46ab16271cb091a0f3fc7597b393394af874efa34a76b59df298f3a",
  "team-time-trial:17": "fa8445b987ec29836379daf77b7358ad1e1a612252dc4a48e90277d663d527bc",
  "team-time-trial:41": "f513c81d5ceaf1ca9123334f95f46629e6182e0c0eb7eb5f3f2b4051e8030b3e",
  "team-time-trial:109": "45834b57ea44e72c276d53adeeca480ef9984ef5e876b47e96a3ebda2ce67c8b",
  "non-urban-cobbled-finish:17": "2f624c27292ae92b4247787205c4156e881742122531013955a1b2b0d50d041b",
  "non-urban-cobbled-finish:41": "c9c6afdafbf98030e5bf1095328f0735c0961f2c66836acf9473dbd6b4c74dcf",
  "non-urban-cobbled-finish:109": "d42e0d5bd51953bad263379be5332e2b28f3ac1a216ff897f0797978332b2104",
  "uphill-finish:17": "8b389d9675cd72a66074fa0a8fe0ca32fa2d0941a57acbb8e81d3f3a4e067d93",
  "uphill-finish:41": "64469c8360c26ffb4664ca343421709feb192fc0fa9274975f6c94b7fea75f48",
  "uphill-finish:109": "7a80a430b439fd51f21fc975bcc53ec48b001804b5073d903560282a7fe47687",
};

function inputFor(scenario: Scenario, seed: number): StageSimulationInput {
  if (scenario === "sprint") return createDemoSimulationInput("sprint-littoral", seed);
  if (scenario === "hilly") return createDemoSimulationInput("collines-ardennes", seed);
  if (scenario === "mountain") return createDemoSimulationInput("haute-montagne", seed);
  if (scenario === "classic-cobbles") return createDemoSimulationInput("paves-zelande", seed);
  if (scenario === "individual-time-trial") return createDemoSimulationInput("chrono-algarve", seed);

  if (scenario === "prologue" || scenario === "team-time-trial") {
    const base = createDemoSimulationInput("chrono-algarve", seed);
    const stageType = scenario === "prologue" ? "prologue" : "team_time_trial";
    return {
      ...base,
      stageType,
      segments: scenario === "prologue"
        ? [{ segmentNumber: 1, distanceKm: 7, terrain: "flat", averageGradientPct: 0, surface: "asphalt", prime: null }]
        : base.segments,
      timeTrialPlans: Object.fromEntries(base.riders.map((rider, index): [string, TimeTrialRiderPlan] => [rider.id, {
        effortMode: index % 3 === 0 ? "all_in" : index % 3 === 1 ? "conserve" : "normal",
        relaySharePct: scenario === "team-time-trial" ? 100 / base.riders.filter((candidate) => candidate.teamId === rider.teamId).length : null,
      }])),
    };
  }

  const base = createDemoSimulationInput("sprint-littoral", seed);
  if (scenario === "flat") {
    return {
      ...base,
      profileType: "flat",
      segments: base.segments.map((segment): RaceStageSegment => ({ ...segment, terrain: "flat", averageGradientPct: 0, surface: "asphalt", prime: null })),
    };
  }
  if (scenario === "non-urban-cobbled-finish") {
    return {
      ...base,
      profileType: "cobbles",
      segments: base.segments.map((segment, index): RaceStageSegment => ({
        ...segment,
        terrain: "flat",
        averageGradientPct: 0,
        surface: index >= base.segments.length - 3 ? "cobbles" : "asphalt",
      })),
    };
  }
  return {
    ...base,
    profileType: "hilly",
    segments: base.segments.map((segment, index): RaceStageSegment => index === base.segments.length - 1
      ? { ...segment, terrain: "climb", averageGradientPct: 7 }
      : segment),
  };
}

function sportingFingerprint(input: StageSimulationInput) {
  const result = simulateRaceStage(input);
  // Explicit projection intentionally excludes future descriptive metadata
  // such as roadFinishMode, but covers incidents, injuries, fatigue and gaps
  // through the complete sporting timelines and results.
  return createHash("sha256").update(JSON.stringify({
    results: result.results,
    timeline: result.timeline,
    visualTimeline: result.visualTimeline,
    primes: result.primes,
    mountainPoints: result.mountainPoints,
    sprintPoints: result.sprintPoints,
    teamWork: result.teamWork,
  })).digest("hex");
}

describe("urban-cobbles correction: exact unrelated sporting baselines", () => {
  it.each(SCENARIOS.flatMap((scenario) => SEEDS.map((seed) => ({ scenario, seed }))))(
    "preserves $scenario, seed $seed",
    ({ scenario, seed }) => {
      const key = `${scenario}:${seed}`;
      const actual = sportingFingerprint(inputFor(scenario, seed));
      if (process.env.URBAN_COBBLES_BASELINE_REPORT === "1") console.info(`${key} ${actual}`);
      expect(actual, key).toBe(EXPECTED[key]);
    },
  );
});
