import { describe, expect, it } from "vitest";

import type { RaceCalendarEdition, RaceCalendarStage } from "./race-calendar";
import { createCalendarSimulationInput, createDemoSimulationInput } from "./race-simulation-demo";
import {
  isRaceLeaderRole,
  isRaceProtectedRiderRole,
  isRaceSprinterRole,
  normalizeTeamTimeTrialRelayShares,
  simulateRaceStage,
  simulateRaceStageResultsOnly,
  type RiderSimulationInput,
  type StageSimulationInput,
} from "./race-simulation";
import { DEFAULT_RACE_TEAM_STRATEGY, type RaceTeamStrategy } from "./race-strategy";
import type { TimeTrialRiderPlan } from "./time-trial-preparation";

const DAY = 140;
const MISSIONS = [
  ["lieutenantRiderId", "lieutenant"],
  ["dangerPacerRiderId", "danger_pacer"],
  ["protectorRiderId", "protector"],
  ["breakawayRiderId", "breakaway_candidate"],
] as const;

function rider(id: string, role: RiderSimulationInput["role"] = "auto", score = 79): RiderSimulationInput {
  return {
    ...createDemoSimulationInput("sprint-littoral", "tactical-preparation").riders[0],
    id,
    name: id,
    teamId: "prepared-team",
    teamName: "Prepared team",
    form: 90,
    role,
    specialAbility: null,
    specialAbilities: [],
    climateProfile: { strength: "rain", weakness: "snow" },
    ratings: {
      mountain: score, hills: score, flat: score, timeTrial: score,
      cobbles: score, sprint: score, acceleration: score, downhill: score,
      endurance: score, resistance: score, recovery: score, breakaway: score,
      prologue: score,
    },
  };
}

function prepared(source: RiderSimulationInput, bonus: number, type: "indoor_track" | "wind_tunnel" = "indoor_track") {
  return {
    ...source,
    performancePreparations: bonus ? [{ type, ratingBonus: bonus, bonusStartGameDay: DAY, bonusEndGameDay: DAY + 5 }] : [],
  };
}

function input(riders: RiderSimulationInput[], strategy?: RaceTeamStrategy): StageSimulationInput {
  return {
    ...createDemoSimulationInput("sprint-littoral", "tactical-preparation"),
    gameDayIndex: DAY,
    riders,
    ...(strategy ? { teamStrategies: [strategy] } : {}),
  };
}

function editionFor(riders: RiderSimulationInput[], strategies: RaceTeamStrategy[], raceFormat: "stage_race" | "one_day" = "stage_race"): RaceCalendarEdition {
  const stage: RaceCalendarStage = {
    id: "preparation-stage", dayNumber: 1, gameDayIndex: DAY, stageNumber: 1,
    name: "Prepared stage", stageType: "road", status: "planned",
    profileType: "sprint", distanceKm: 154, daySlot: "early", departureAt: null,
    segments: createDemoSimulationInput("sprint-littoral", "tactical-preparation").segments,
    teamStrategies: Object.fromEntries(strategies.map((strategy) => [strategy.teamId, strategy])),
  };
  return {
    id: "preparation-edition", raceId: "preparation-race", slug: "preparation-race",
    name: "Preparation race", shortName: null, countryName: "Belgique", countryCode: "BE",
    categoryCode: "national", categoryName: "National", prestigeRank: 4,
    raceFormat, competitionType: "standard", registrationClosesAt: null,
    wildcardClosesAt: null, withdrawalClosesAt: null, registrationPolicy: "open",
    minimumReputation: 0, minimumRosterSize: 1, maximumRosterSize: 8,
    engagedRiderCount: riders.length, engagedRiders: riders,
    currentTeamRegistration: null, stages: [stage],
  };
}

function isProtected(rider: RiderSimulationInput) {
  return isRaceLeaderRole(rider.role) || isRaceSprinterRole(rider.role) || isRaceProtectedRiderRole(rider.role);
}

describe.each([
  ["live", simulateRaceStage],
  ["results only", simulateRaceStageResultsOnly],
] as const)("preparations and tactical priority — %s", (_, simulate) => {
  it.each(MISSIONS)("keeps the explicit %s mission ahead of an automatic sprint promotion", (field, duty) => {
    for (const bonus of [0, 3.3]) {
      const helper = prepared({ ...rider("assigned-helper", "auto", 79), raceDuty: duty }, bonus);
      const strategy = { ...DEFAULT_RACE_TEAM_STRATEGY, teamId: helper.teamId, [field]: helper.id };
      const raceInput = input([rider("leader", "leader", 70), helper, rider("sprinter-candidate", "auto", 81)], strategy);
      const before = structuredClone(raceInput);
      const result = simulate(raceInput);
      const resolved = result.resolvedRiders.find((row) => row.id === helper.id)!;
      expect(isProtected(resolved)).toBe(false);
      expect(resolved.raceDuty).toBe(duty);
      expect(result.resolvedRiders.find((row) => row.id === "sprinter-candidate")?.role).toBe("leader_sprinter");
      expect(raceInput).toEqual(before);
    }
  });

  it.each(MISSIONS)("honors %s supplied only in the team strategy, without a duplicate rider field", (field) => {
    const helper = prepared(rider("assigned-helper", "auto", 84), 3.3);
    const strategy = { ...DEFAULT_RACE_TEAM_STRATEGY, teamId: helper.teamId, [field]: helper.id };
    const result = simulate(input([rider("leader", "leader", 70), helper, rider("sprinter-candidate", "auto", 81)], strategy));
    expect(isProtected(result.resolvedRiders.find((row) => row.id === helper.id)!)).toBe(false);
    expect(result.resolvedRiders.find((row) => row.id === "sprinter-candidate")?.role).toBe("leader_sprinter");
  });

  it.each(["collines-ardennes", "haute-montagne", "paves-zelande"] as const)("does not turn a designated helper into a leader on %s", (scenario) => {
    for (const [field, duty] of MISSIONS) {
      const helper = prepared({ ...rider("assigned-helper", "auto", 85), raceDuty: duty }, 3.3, "wind_tunnel");
      const strategy = { ...DEFAULT_RACE_TEAM_STRATEGY, teamId: helper.teamId, [field]: helper.id };
      const raceInput = { ...input([helper, rider("automatic-candidate", "auto", 80)], strategy), ...createDemoSimulationInput(scenario, "duty-road-profile"), riders: [helper, rider("automatic-candidate", "auto", 80)], gameDayIndex: DAY, teamStrategies: [strategy] };
      const result = simulate(raceInput);
      const resolved = result.resolvedRiders.find((row) => row.id === helper.id)!;
      expect(isProtected(resolved)).toBe(false);
      expect(resolved.raceDuty).toBe(duty);
      expect(result.resolvedRiders.find((row) => row.id === "automatic-candidate")?.role).toBe("leader");
    }
  });

  it("does not invent a protected leader when every rider has a support mission", () => {
    const helpers = MISSIONS.map(([, duty], index) => prepared({ ...rider(`helper-${index}`), raceDuty: duty }, 3.3));
    const strategy = { ...DEFAULT_RACE_TEAM_STRATEGY, teamId: "prepared-team", ...Object.fromEntries(MISSIONS.map(([field], index) => [field, helpers[index].id])) };
    const result = simulate(input(helpers, strategy));
    expect(result.resolvedRiders.some(isProtected)).toBe(false);
    expect(result.resolvedRiders.map((row) => row.raceDuty)).toEqual(helpers.map((row) => row.raceDuty));
  });

  it("retains every explicit role, even when a prepared helper has better notes", () => {
    const chosen: RiderSimulationInput["role"][] = ["leader", "leader_sprinter", "protected_rider", "leadout", "domestique"];
    const riders = chosen.map((role) => prepared(rider(role, role, role === "domestique" ? 95 : 70), 3.3));
    const result = simulate(input(riders));
    expect(result.resolvedRiders.map((row) => row.role)).toEqual(chosen);
  });

  it("still promotes a better prepared rider left fully automatic", () => {
    const candidate = prepared(rider("prepared-auto", "auto", 79), 3.3);
    const result = simulate(input([rider("leader", "leader", 70), candidate, rider("other-auto", "auto", 81)]));
    expect(result.resolvedRiders.find((row) => row.id === candidate.id)?.role).toBe("leader_sprinter");
  });

  it.each(MISSIONS)("retains existing GC protection ahead of a conflicting %s mission, with or without preparation", (field, duty) => {
    for (const bonus of [0, 3.3]) {
      const helper = prepared({ ...rider("gc-contender", "auto", 84), raceDuty: duty }, bonus);
      const strategy = { ...DEFAULT_RACE_TEAM_STRATEGY, teamId: helper.teamId, [field]: helper.id };
      const raceInput: StageSimulationInput = {
        ...input([rider("declared-leader", "leader", 70), helper, rider("stage-candidate", "auto", 81)], strategy),
        isStageRace: true,
        generalClassification: [
          { riderId: "outside-gc-leader", elapsedTimeSeconds: 10_000 },
          { riderId: helper.id, elapsedTimeSeconds: 10_030 },
          ...Array.from({ length: 4 }, (_, index) => ({ riderId: `outside-gc-${index}`, elapsedTimeSeconds: 10_060 + index })),
          { riderId: "stage-candidate", elapsedTimeSeconds: 12_000 },
        ],
      };
      const before = structuredClone(raceInput);
      const result = simulate(raceInput);
      expect(result.resolvedRiders.find((row) => row.id === helper.id)).toMatchObject({
        role: "domestique", generalClassificationProtected: true, raceDuty: null,
      });
      expect(result.resolvedRiders.find((row) => row.id === "stage-candidate")?.role).toBe("leader_sprinter");
      expect(raceInput).toEqual(before);
    }
  });
});

describe("automatic stage-race leaders and explicit duties", () => {
  it.each(MISSIONS)("does not lock a rider assigned %s as automatic tour leader", (field, duty) => {
    const helper = prepared(rider("best-but-assigned", "auto", 90), 3.3, "wind_tunnel");
    const candidate = rider("available-auto", "auto", 80);
    const strategy = { ...DEFAULT_RACE_TEAM_STRATEGY, teamId: helper.teamId, [field]: helper.id };
    const edition = editionFor([helper, candidate], [strategy]);
    const source = structuredClone(edition);
    const raceInput = createCalendarSimulationInput({ edition, stage: edition.stages[0], seed: "duty-tour" });
    expect(raceInput.riders.find((row) => row.id === helper.id)?.role).toBe("auto");
    expect(raceInput.riders.find((row) => row.id === helper.id)?.raceDuty).toBe(duty);
    expect(raceInput.riders.find((row) => row.id === candidate.id)?.role).toBe("leader");
    for (const simulate of [simulateRaceStage, simulateRaceStageResultsOnly]) {
      const resolved = simulate(raceInput).resolvedRiders.find((row) => row.id === helper.id)!;
      expect(isProtected(resolved)).toBe(false);
      expect(resolved.raceDuty).toBe(duty);
    }
    expect(edition).toEqual(source);
  });

  it("keeps an explicitly appointed tour leader and discards an obsolete conflicting support mission", () => {
    const leader = prepared(rider("declared-leader", "leader", 90), 3.3);
    const strategy = { ...DEFAULT_RACE_TEAM_STRATEGY, teamId: leader.teamId, lieutenantRiderId: leader.id };
    const edition = editionFor([leader, rider("helper", "domestique")], [strategy]);
    const raceInput = createCalendarSimulationInput({ edition, stage: edition.stages[0], seed: "explicit-tour" });
    expect(raceInput.riders.find((row) => row.id === leader.id)?.role).toBe("leader");
    expect(raceInput.teamStrategies?.[0].lieutenantRiderId).toBeNull();
    expect(raceInput.riders.find((row) => row.id === leader.id)?.raceDuty).toBeUndefined();
  });

  it("does not invent a tour leader when every automatic rider has an explicit mission", () => {
    const helpers = MISSIONS.map(([, duty], index) => prepared({ ...rider(`helper-${index}`), raceDuty: duty }, 3.3));
    const strategy = { ...DEFAULT_RACE_TEAM_STRATEGY, teamId: "prepared-team", ...Object.fromEntries(MISSIONS.map(([field], index) => [field, helpers[index].id])) };
    const edition = editionFor(helpers, [strategy]);
    const raceInput = createCalendarSimulationInput({ edition, stage: edition.stages[0], seed: "all-tour-support" });
    expect(raceInput.riders.every((row) => row.role === "auto")).toBe(true);
    for (const simulate of [simulateRaceStage, simulateRaceStageResultsOnly]) {
      const resolved = simulate(raceInput).resolvedRiders;
      expect(resolved.some(isProtected)).toBe(false);
      expect(resolved.map((row) => row.raceDuty)).toEqual(helpers.map((row) => row.raceDuty));
    }
  });

  it("gives an explicit stage leader choice priority over an obsolete tactical mission", () => {
    const leader = prepared(rider("chosen-stage-leader", "auto", 85), 3.3);
    const strategy = { ...DEFAULT_RACE_TEAM_STRATEGY, teamId: leader.teamId, dangerPacerRiderId: leader.id };
    const edition = editionFor([leader, rider("other-auto")], [strategy]);
    edition.stages[0].riderRoleOverrides = { [leader.id]: "leader" };
    const raceInput = createCalendarSimulationInput({ edition, stage: edition.stages[0], seed: "explicit-stage-leader" });
    expect(raceInput.riders.find((row) => row.id === leader.id)?.role).toBe("leader");
    expect(raceInput.teamStrategies?.[0].dangerPacerRiderId).toBeNull();
    expect(raceInput.riders.find((row) => row.id === leader.id)?.raceDuty).toBeUndefined();
  });

  it("uses the latest saved strategy instead of reserving a stale historical duty", () => {
    const candidate = { ...rider("best-auto", "auto", 90), raceDuty: "protector" as const };
    const strategy = { ...DEFAULT_RACE_TEAM_STRATEGY, teamId: candidate.teamId };
    const edition = editionFor([candidate, rider("other-auto")], [strategy]);
    const raceInput = createCalendarSimulationInput({ edition, stage: edition.stages[0], seed: "stale-historical-duty" });
    expect(raceInput.riders.find((row) => row.id === candidate.id)?.role).toBe("leader");
    expect(raceInput.riders.find((row) => row.id === candidate.id)?.raceDuty).toBeUndefined();
  });
});

describe("wind-tunnel preparations and time-trial instructions", () => {
  it.each([0, 3.3])("preserves the all-in versus conservation tradeoff with +%s wind preparation", (bonus) => {
    const source = prepared(rider("chrono", "leader", 80), bonus, "wind_tunnel");
    const base = { ...createDemoSimulationInput("chrono-algarve", 87), gameDayIndex: DAY, riders: [source] };
    const simulateEffort = (effortMode: "conserve" | "all_in") => {
      const raceInput = { ...base, timeTrialPlans: { chrono: { effortMode, relaySharePct: null } } };
      const before = structuredClone(raceInput);
      const result = simulateRaceStage(raceInput).results[0];
      expect(raceInput).toEqual(before);
      return result;
    };
    const conserving = simulateEffort("conserve");
    const allIn = simulateEffort("all_in");
    expect(allIn.elapsedTimeSeconds).toBeLessThan(conserving.elapsedTimeSeconds);
    expect(allIn.energyAfter).toBeLessThan(conserving.energyAfter);
  });

  it.each([0, 3.3])("keeps relay orders and their effect with +%s wind preparation", (bonus) => {
    const strong = prepared(rider("strong", "leader", 88), bonus, "wind_tunnel");
    const weak = prepared(rider("weak", "domestique", 52), bonus, "wind_tunnel");
    const simulateRelays = (strongShare: number) => {
      const plans: Record<string, TimeTrialRiderPlan> = {
        strong: { effortMode: "normal", relaySharePct: strongShare },
        weak: { effortMode: "normal", relaySharePct: 100 - strongShare },
      };
      const raceInput: StageSimulationInput = { ...createDemoSimulationInput("chrono-algarve", 103), stageType: "team_time_trial", gameDayIndex: DAY, riders: [strong, weak], timeTrialPlans: plans };
      const before = structuredClone(raceInput);
      expect(normalizeTeamTimeTrialRelayShares([strong.id, weak.id], plans)).toEqual({ strong: strongShare / 100, weak: (100 - strongShare) / 100 });
      const result = simulateRaceStage(raceInput).results[0];
      expect(raceInput).toEqual(before);
      return result;
    };
    expect(simulateRelays(80).elapsedTimeSeconds).toBeLessThan(simulateRelays(20).elapsedTimeSeconds);
  });
});

describe("danger pacer availability and existing GC protection", () => {
  function simulatePacer({ bonus, protectedAtGc, assigned, unavailable = false }: {
    bonus: number;
    protectedAtGc: boolean;
    assigned: boolean;
    unavailable?: boolean;
  }) {
    const base = createDemoSimulationInput("collines-ardennes", 1);
    const source = base.riders.find((row) => row.role === "domestique")!;
    const pacer = prepared({ ...source, generalClassificationProtected: protectedAtGc }, bonus);
    return simulateRaceStage({
      ...base,
      gameDayIndex: DAY,
      riders: base.riders.map((row) => row.id === pacer.id ? pacer : row),
      teamStrategies: [{
        ...DEFAULT_RACE_TEAM_STRATEGY,
        teamId: pacer.teamId,
        dangerPacerRiderId: assigned ? pacer.id : null,
      }],
      ...(unavailable ? { unavailableRiderIds: [pacer.id] } : {}),
    });
  }

  it.each([0, 3.3])("does not add ghost chase pressure for a GC-protected pacer with +%s preparation", (bonus) => {
    const withPacer = simulatePacer({ bonus, protectedAtGc: true, assigned: true });
    const withoutPacer = simulatePacer({ bonus, protectedAtGc: true, assigned: false });
    expect(JSON.stringify(withPacer) === JSON.stringify(withoutPacer)).toBe(true);
  });

  it.each([0, 3.3])("keeps a non-protected pacer's effect, including legacy inputs without raceDuty, with +%s preparation", (bonus) => {
    const withPacer = simulatePacer({ bonus, protectedAtGc: false, assigned: true });
    const withoutPacer = simulatePacer({ bonus, protectedAtGc: false, assigned: false });
    const pressures = (simulation: typeof withPacer) => simulation.visualTimeline?.map((frame) => frame.frontDynamics?.chasePressure);
    expect(pressures(withPacer)).not.toEqual(pressures(withoutPacer));
  });

  it.each([0, 3.3])("still neutralizes a withdrawn or medically unavailable pacer's order with +%s preparation", (bonus) => {
    const withPacer = simulatePacer({ bonus, protectedAtGc: false, assigned: true, unavailable: true });
    const withoutPacer = simulatePacer({ bonus, protectedAtGc: false, assigned: false, unavailable: true });
    expect(JSON.stringify(withPacer) === JSON.stringify(withoutPacer)).toBe(true);
  });
});
