import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import {
  assignRaceObjectiveDuties,
  selectStageAttackPlan,
  simulateRaceStage,
  simulateRaceStageResultsOnly,
  type RiderSimulationInput,
} from "./race-simulation";
import { DEFAULT_RACE_TEAM_STRATEGY, type RaceTeamStrategy } from "./race-strategy";
import { createSeededRandom } from "./youth-development";

const TRIALS = 512;
const demo = createDemoSimulationInput("collines-ardennes", "role-balance-fixture");
const model = demo.riders[0];

function seededRandom(seed: number) {
  // The same FNV/Mulberry generator used by the engine avoids correlations
  // between neighboring integer seeds when measuring a rare event.
  return createSeededRandom(`breakaway-role-balance:${seed}`);
}

function rider(id: string, teamId: string, leader = false): RiderSimulationInput {
  return {
    ...model,
    id,
    name: id,
    teamId,
    role: leader ? "leader" : "domestique",
    raceDuty: null,
    form: 90,
    countryCode: "DE",
    favoriteRaceBonus: 0,
    localRaceBonus: 0,
    specialAbility: null,
    specialAbilities: [],
    ratings: {
      ...model.ratings,
      mountain: 60,
      hills: teamId === "target" ? 55 : 70,
      flat: 65,
      sprint: 55,
      breakaway: 70,
      acceleration: 68,
      endurance: 70,
    },
  };
}

const rivals = Array.from({ length: 11 }, (_, teamIndex) => [
  rider(`leader-${teamIndex}`, `rival-${teamIndex}`, true),
  ...Array.from({ length: 5 }, (_, index) =>
    rider(`rival-${teamIndex}-${index}`, `rival-${teamIndex}`),
  ),
]).flat();

function field(helperCount = 5, amend?: (candidate: RiderSimulationInput) => RiderSimulationInput) {
  return [
    rider("leader", "target", true),
    ...Array.from({ length: helperCount }, (_, index) => {
      const candidate = rider(`helper-${index}`, "target");
      return amend ? amend(candidate) : candidate;
    }),
    ...rivals,
  ];
}

function teamStrategy(change: Partial<RaceTeamStrategy> = {}): RaceTeamStrategy {
  return { ...DEFAULT_RACE_TEAM_STRATEGY, teamId: "target", ...change };
}

function countRepresented(
  riders = field(),
  strategy = teamStrategy(),
  raceCountryCode: string | null = "FR",
  includeApprovedInitiatives = false,
) {
  let represented = 0;
  const targetIds = riders
    .filter((candidate) => candidate.teamId === "target" && candidate.role !== "leader")
    .map((candidate) => candidate.id);
  for (let seed = 1; seed <= TRIALS; seed++) {
    const plan = selectStageAttackPlan(
      riders,
      demo.segments,
      seededRandom(seed),
      undefined,
      [strategy],
      raceCountryCode,
    );
    // Count an initiative in either wave, rather than letting a failed morning
    // roll escape the role restriction through the planned late attack.
    if (targetIds.some((id) => plan.initialAttackIds.has(id) || plan.delayedAttackIds.has(id) ||
      (includeApprovedInitiatives && plan.eligibleUnplannedAttackIds.has(id)))) {
      represented++;
    }
  }
  return represented;
}

describe("breakaway initiative respects support roles", () => {
  it("keeps an ordinary domestique initiative possible but rare", () => {
    const represented = countRepresented();
    expect(represented).toBeGreaterThan(0);
    expect(represented / TRIALS).toBeLessThan(0.2);
  });

  it("does not turn one chance into a near guarantee with five or seven domestiques", () => {
    const counts = [1, 5, 7].map((helpers) => countRepresented(field(helpers)));
    for (const represented of counts) expect(represented / TRIALS).toBeLessThan(0.2);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThan(TRIALS * 0.06);
  });

  it("lets breakaway skill, a favorite race and the home nation each increase initiative", () => {
    const ordinary = countRepresented();
    const strongBaroudeurs = countRepresented(field(5, (candidate) => ({
      ...candidate, ratings: { ...candidate.ratings, breakaway: 95 },
    })));
    const favorite = countRepresented(field(5, (candidate) => ({ ...candidate, favoriteRaceBonus: 2 })));
    const home = countRepresented(field(5, (candidate) => ({ ...candidate, countryCode: "FR" })));
    expect(strongBaroudeurs).toBeGreaterThan(ordinary);
    expect(favorite).toBeGreaterThan(ordinary);
    expect(home).toBeGreaterThan(ordinary);
    for (const represented of [strongBaroudeurs, favorite, home]) {
      expect(represented / TRIALS).toBeLessThan(0.2);
    }
  });

  it("does not confuse a foreign rider's local status with the race nationality", () => {
    const localRiders = field(5, (candidate) => ({ ...candidate, localRaceBonus: 5 }));
    const nationals = field(5, (candidate) => ({
      ...candidate, localRaceBonus: 5, countryCode: "FR",
    }));
    // Keep the performance bonus identical: only the actual nationality differs.
    // Count approved initiatives here, before the favorite team's separate
    // launch penalty can suppress both groups' eventual departures.
    expect(countRepresented(nationals, teamStrategy(), "FR", true))
      .toBeGreaterThan(countRepresented(localRiders, teamStrategy(), "FR", true));
  });

  it("keeps an explicit avoid policy effective despite every motivation", () => {
    const motivated = field(5, (candidate) => ({
      ...candidate,
      countryCode: "FR",
      favoriteRaceBonus: 2,
      specialAbility: "panache",
      ratings: { ...candidate.ratings, breakaway: 95 },
    }));
    expect(countRepresented(motivated, teamStrategy({ breakawayPolicy: "avoid" }))).toBe(0);
  });

  it.each([
    { breakawayPolicy: "target" as const },
    { objective: "breakaway" as const },
  ])("preserves explicit team instructions to seek the breakaway (%j)", (instruction) => {
    expect(countRepresented(field(), teamStrategy(instruction)) / TRIALS).toBeGreaterThan(0.5);
  });

  it("honors a designated attacker even before its derived raceDuty is materialized", () => {
    const plan = selectStageAttackPlan(
      field(), demo.segments, () => 0.99, undefined,
      [teamStrategy({ breakawayRiderId: "helper-0" })], "FR",
    );
    expect(plan.initialAttackIds.has("helper-0")).toBe(true);
  });

  it("does not silently convert a stage-win objective into a domestique breakaway duty", () => {
    const riders = assignRaceObjectiveDuties({
      ...demo, riders: field(), teamStrategies: [teamStrategy({ objective: "stage_win" })],
    });
    expect(riders.filter((candidate) => candidate.teamId === "target" && candidate.raceDuty === "breakaway_candidate"))
      .toHaveLength(0);
  });

  it("allows a stage-win objective to designate a domestique when the DS targets the breakaway", () => {
    const riders = assignRaceObjectiveDuties({
      ...demo,
      riders: field(),
      teamStrategies: [teamStrategy({ objective: "stage_win", breakawayPolicy: "target" })],
    });
    const candidates = riders.filter((candidate) => candidate.teamId === "target" && candidate.raceDuty === "breakaway_candidate");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].role).toBe("domestique");
  });

  it("does not let an implicit stage-win mission override an avoid instruction", () => {
    const strategy = teamStrategy({ objective: "stage_win", breakawayPolicy: "avoid" });
    const riders = assignRaceObjectiveDuties({
      ...demo,
      riders: field(5, (candidate) => candidate.id === "helper-0"
        ? { ...candidate, role: "free_agent" }
        : candidate),
      teamStrategies: [strategy],
    });
    const targetIds = riders.filter((candidate) => candidate.teamId === "target").map((candidate) => candidate.id);
    expect(riders.filter((candidate) => targetIds.includes(candidate.id) && candidate.raceDuty === "breakaway_candidate"))
      .toHaveLength(0);
    const plan = selectStageAttackPlan(riders, demo.segments, () => 0, undefined, [strategy], "FR");
    for (const id of targetIds) {
      expect(plan.initialAttackIds.has(id), id).toBe(false);
      expect(plan.delayedAttackIds.has(id), id).toBe(false);
      expect(plan.eligibleUnplannedAttackIds.has(id), id).toBe(false);
    }
  });

  it("keeps leadouts and support missions out of both waves and automatic counterattacks", () => {
    const riders = field(5, (candidate) => candidate.id === "helper-4"
      ? { ...candidate, role: "leadout" }
      : candidate);
    const strategy = teamStrategy({
      lieutenantRiderId: "helper-0",
      dangerPacerRiderId: "helper-1",
      protectorRiderId: "helper-2",
    });
    const plan = selectStageAttackPlan(riders, demo.segments, () => 0, undefined, [strategy], "FR");
    for (const id of ["helper-0", "helper-1", "helper-2", "helper-4", "leader"]) {
      expect(plan.initialAttackIds.has(id), id).toBe(false);
      expect(plan.delayedAttackIds.has(id), id).toBe(false);
      expect(plan.eligibleUnplannedAttackIds.has(id), id).toBe(false);
    }
  });
});

describe.each([
  ["live", simulateRaceStage],
  ["results only", simulateRaceStageResultsOnly],
] as const)("balanced roles still produce complete deterministic results — %s", (_, simulate) => {
  it.each(["collines-ardennes", "sprint-littoral", "chrono-algarve"] as const)(
    "keeps support, sprint train and prepared attacks compatible on %s",
    (scenario) => {
      const input = createDemoSimulationInput(scenario, "role-balance-results");
      const targetTeamId = input.riders[0].teamId;
      const teammates = input.riders.filter((candidate) => candidate.teamId === targetTeamId);
      const roles = ["leader", "leadout", "domestique", "free_agent", "domestique", "domestique"] as const;
      const riders = input.riders.map((candidate) => candidate.teamId !== targetTeamId
        ? candidate
        : { ...candidate, role: roles[teammates.findIndex((mate) => mate.id === candidate.id)] });
      const options = {
        ...input,
        riders,
        teamStrategies: [{
          ...teamStrategy(),
          teamId: targetTeamId,
          lieutenantRiderId: teammates[2].id,
          dangerPacerRiderId: teammates[4].id,
          protectorRiderId: teammates[5].id,
          breakawayRiderId: teammates[3].id,
          sprintTrainOrder: [teammates[1].id],
          attackOrders: [{
            riderId: teammates[1].id,
            segmentNumber: input.segments.at(-2)!.segmentNumber,
            intensity: "measured" as const,
            condition: "always" as const,
          }],
        }],
      };
      const before = structuredClone(options);
      const result = simulate(options);
      expect(result.results).toHaveLength(input.riders.length);
      expect(new Set(result.results.map((row) => row.riderId)).size).toBe(input.riders.length);
      expect(result.results.every((row) => Number.isFinite(row.elapsedTimeSeconds))).toBe(true);
      expect(options).toEqual(before);
      expect(simulate(options)).toEqual(result);
    },
    15_000,
  );
});
