import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
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
const FLAT_FINISH_SCENARIOS = [
  "sprint", "flat", "classic-cobbles", "non-urban-cobbled-finish",
] as const satisfies readonly Scenario[];
const UNCHANGED_FINISH_SCENARIOS = SCENARIOS.filter(
  (scenario) => !FLAT_FINISH_SCENARIOS.some((flatFinish) => flatFinish === scenario),
);

// Captured before the urban-circuit correction. Do not regenerate these when
// changing the finish algorithm: unrelated sporting outputs must stay exact.
// v52 intentionally changes the four flat-finish scenarios. Keep their original
// full fingerprints here as provenance, and freeze their complete race physics
// immediately before the finish calculation separately below.
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

// Captured from v51, commit 4a9ef3c27e86e641c3a80e3b3dd514a86a69e440.
// Unlike a projection of returned timelines (whose final snapshot has already
// been rewritten), these cover the physical final snapshot before any finish
// score, added effort, classification points, or final-group normalization.
const EXPECTED_PRE_FINISH_PHYSICS: Record<string, string> = {
  "sprint:17": "b096aa4afa6a0783af287a778a92638d5ee4eb4e2ae6c2db9ae8d49a6ec93fa5",
  "sprint:41": "9e92907fb58fe5960a1d1141b7d267c34f3ff9dc360fbfa2f84a38071d1ac0f0",
  "sprint:109": "996d5c53d2a2d874e94d19f06e99c5d3b98921f518c8cfef300573067825e8f6",
  "flat:17": "b096aa4afa6a0783af287a778a92638d5ee4eb4e2ae6c2db9ae8d49a6ec93fa5",
  "flat:41": "9e92907fb58fe5960a1d1141b7d267c34f3ff9dc360fbfa2f84a38071d1ac0f0",
  "flat:109": "996d5c53d2a2d874e94d19f06e99c5d3b98921f518c8cfef300573067825e8f6",
  "classic-cobbles:17": "fdd625363cf68afd4cdce6618c171fae0eabee042b568438cfcdcf70b004ddf8",
  "classic-cobbles:41": "0403b5bdb2020f38f306eeed45ca67cad52c0e1abe54279f80792d662441e451",
  "classic-cobbles:109": "90a4f336b16191e47326774095177c586e7ddc657ede829bbd2f0743792367d8",
  "non-urban-cobbled-finish:17": "426fd1dfdf943df23f29918f02748ad940d7fd787aff5fd66cc33b4d645bbddb",
  "non-urban-cobbled-finish:41": "5c08d408ddb1f1792df07812bed3bb35bdbfef8a355c719b0ad8cd1141e1cc29",
  "non-urban-cobbled-finish:109": "aad489ec083ca5811a2c3dfca6e31368a011edf52151a69214b06711578eb916",
};

// v53 removes hidden favorite protection from riders assigned support roles.
// Reinstating only that old protection reproduces every original hash above.
// Keep those original baselines as provenance and freeze only the affected
// scenarios here; the other scenarios must remain byte-for-byte identical.
const DS_ROLE_PRIORITY_EXPECTED: Record<string, string> = {
  "hilly:41": "1a9931d041c9a74af00de0446fa44a348a7bb5bfbb527f77bfa0fb2eb1077dc8",
  "hilly:109": "122efdb4d9b0755d67a4506646d4d2b6cb48c7bcfc6a2705be3547c11be52c4a",
  "uphill-finish:17": "0fd65a2231573487448e135676a7d2a45c7adc90799bb6a4f2b5b9b9630a21b8",
  "uphill-finish:41": "788e73ee1ccfc67a6577319623ff82cfe364730b58b2fb920773a3e82def2712",
  "uphill-finish:109": "2ce6e7ab17b6c764522b977629ebf0e95787bd5fe2a57726faba6cc9e9d03efb",
};
const DS_ROLE_PRIORITY_PRE_FINISH_PHYSICS: Record<string, string> = {
  "classic-cobbles:17": "11f0e7a05fe7be0fcf2aa18e01c3cd4758a5780b9543d02ab282abbdaaa3ebe8",
  "classic-cobbles:41": "6dc55a50de72e1b78934cab4ee145f06cbc1d2cdac37d2367a28158a580e7091",
  "classic-cobbles:109": "93bda583fc5bcb3bed0cd3c6e6a36ba3068f72a9dda75dce8815d33cc8e5bb4b",
  "non-urban-cobbled-finish:17": "24848e167253c4f9fcebff260b356ddaa4365a9dd56c7c43423b6a6873ef0076",
  "non-urban-cobbled-finish:41": "b9c5a944bce9daf09b0db64feb6c117278999d6d572e6bd8ddf56fe84f533c09",
  "non-urban-cobbled-finish:109": "13db21624e28b0d7975b8526ddf07149e02b74cd9764a414710df3c18f2cdea5",
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

function createPreFinishPhysicsProbe() {
  const enginePath = fileURLToPath(new URL("./race-simulation.ts", import.meta.url));
  const source = readFileSync(enginePath, "utf8").replace(/\r\n/g, "\n");
  const anchor = "  const finalCommentary = timeline.at(-1)?.commentary ?? [];";
  if (source.split(anchor).length !== 2) {
    throw new Error("The pre-finish physics probe must match exactly one road finish.");
  }
  // Instrument only an in-memory test module. The shipped engine has no hooks,
  // extra serialization, test fixtures, or runtime dependency on this probe.
  const instrumentedSource = source.replace(anchor, `
  __capturePreFinishPhysics({
    timeline,
    visualTimeline,
    states: [...states.entries()],
    primes,
    mountainPoints,
    sprintPoints,
    tacticalReports: tacticalResolution.reports,
    teamWork: teamWorkRecorder.periods,
  });
${anchor}`);
  const compiled = transpileModule(instrumentedSource, {
    compilerOptions: {
      module: ModuleKind.CommonJS,
      target: ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const requireFromEngine = createRequire(enginePath);
  requireFromEngine("tsx/cjs");
  let capturedFingerprint: string | undefined;
  let captureCount = 0;
  const exports: { simulateRaceStage?: typeof simulateRaceStage } = {};
  new Function("require", "module", "exports", "__capturePreFinishPhysics", compiled)(
    requireFromEngine,
    { exports },
    exports,
    (physics: unknown) => {
      captureCount += 1;
      capturedFingerprint = createHash("sha256")
        .update(JSON.stringify(physics)).digest("hex");
    },
  );
  if (!exports.simulateRaceStage) throw new Error("The physics probe did not load the road engine.");
  const instrumentedSimulation = exports.simulateRaceStage;
  return (input: StageSimulationInput) => {
    captureCount = 0;
    capturedFingerprint = undefined;
    instrumentedSimulation(input);
    if (captureCount !== 1 || !capturedFingerprint) {
      throw new Error("The road engine must capture its physical finish exactly once.");
    }
    return capturedFingerprint;
  };
}

const preFinishPhysicsFingerprint = createPreFinishPhysicsProbe();

describe("urban-cobbles correction: exact unrelated sporting baselines", () => {
  it.each(UNCHANGED_FINISH_SCENARIOS.flatMap((scenario) => SEEDS.map((seed) => ({ scenario, seed }))))(
    "preserves $scenario, seed $seed",
    ({ scenario, seed }) => {
      const key = `${scenario}:${seed}`;
      const actual = sportingFingerprint(inputFor(scenario, seed));
      if (process.env.URBAN_COBBLES_BASELINE_REPORT === "1") console.info(`${key} ${actual}`);
      expect(actual, key).toBe(DS_ROLE_PRIORITY_EXPECTED[key] ?? EXPECTED[key]);
    },
  );
});

describe("flat-sprint correction: race physics preserve the role-aware baselines", () => {
  it.each(FLAT_FINISH_SCENARIOS.flatMap((scenario) => SEEDS.map((seed) => ({ scenario, seed }))))(
    "preserves every pre-finish state, snapshot, incident, prime and team action for $scenario, seed $seed",
    ({ scenario, seed }) => {
      const key = `${scenario}:${seed}`;
      expect(preFinishPhysicsFingerprint(inputFor(scenario, seed)), key)
        .toBe(DS_ROLE_PRIORITY_PRE_FINISH_PHYSICS[key] ?? EXPECTED_PRE_FINISH_PHYSICS[key]);
    },
  );
});
