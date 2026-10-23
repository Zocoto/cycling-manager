import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { RaceStageSegment } from "./race-profiles";
import {
  getRoadCrashRiskProfile,
  getRoadFinishMode,
  isLikelyMassSprint,
  isMassGroupFinish,
  simulateRaceStage,
  type RiderSimulationInput,
  type StageSimulationInput,
} from "./race-simulation";
import { DEFAULT_RACE_TEAM_STRATEGY } from "./race-strategy";
import { normalizeUrbanCobblesSegments } from "./urban-cobbles";

function parisRoute(): RaceStageSegment[] {
  const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260925134500_shape_next_french_gt_champs_elysees_finale.sql"), "utf8");
  return [...migration.matchAll(/\((\d+)::smallint,\s*([\d.]+)::numeric,\s*'(flat|climb|descent)'::text,\s*'(asphalt|cobbles)'::text,\s*(-?[\d.]+)::numeric\)/g)]
    .map(match => ({ segmentNumber: Number(match[1]), distanceKm: Number(match[2]), terrain: match[3] as RaceStageSegment["terrain"], surface: match[4] as RaceStageSegment["surface"], averageGradientPct: Number(match[5]), prime: null }));
}

function rider(team: number, slot: number): RiderSimulationInput {
  const sprint = slot === 1;
  const leader = slot === 0;
  return {
    id: `urban-${team}-${slot}`, name: `Rider ${team}-${slot}`,
    teamId: `team-${team}`, teamName: `Team ${team}`,
    teamPrimaryColor: "#176951", teamSecondaryColor: "#ffffff",
    age: 27, form: 95, morale: 70,
    role: leader ? "leader" : sprint ? "leader_sprinter" : slot === 2 ? "leadout" : "domestique",
    specialAbilities: leader ? ["giclette"] : [],
    ratings: {
      flat: leader ? 67 : 77 + team / 10,
      hills: leader ? 83 : 60, mountain: leader ? 93 : 45,
      downhill: 65, sprint: sprint ? 88 + team / 10 : leader ? 58 : 70,
      cobbles: leader ? 62 : 56, acceleration: sprint ? 85 : 68,
      endurance: 78, resistance: 76, recovery: 75,
      timeTrial: 65, prologue: 65, breakaway: 45,
    },
  };
}

function input(seed = 17): StageSimulationInput {
  const riders = Array.from({ length: 8 }, (_, team) => Array.from({ length: 5 }, (_, slot) => rider(team, slot))).flat();
  return {
    id: "rolling-urban-circuit", name: "Urban circuit", stageType: "road", profileType: "flat",
    seed, isStageRace: true, stageNumber: 12, stageCount: 12,
    weather: { condition: "clear", rainIntensity: "none", temperatureC: 20, windSpeedKph: 0, windDirection: "headwind", windIntensity: "calm", isWet: false },
    segments: parisRoute(), riders,
    generalClassification: riders.map(row => ({ riderId: row.id, elapsedTimeSeconds: 100000 + (row.role === "leader" ? Number(row.teamId.slice(5)) : 1000) })),
    teamStrategies: Array.from({ length: 8 }, (_, team) => ({ ...DEFAULT_RACE_TEAM_STRATEGY, teamId: `team-${team}`, objective: "sprint" as const, breakawayPolicy: "avoid" as const, chasePolicy: "always" as const, attackOrders: [] })),
  };
}

describe("rolling urban cobbles sporting integration", () => {
  it("recognizes the authored Paris circuit without renaming or removing any paved road", () => {
    const source = input();
    const route = normalizeUrbanCobblesSegments(source);
    expect(route.filter(segment => segment.cobblesStyle === "urban")).toHaveLength(5);
    expect(route.filter(segment => segment.surface === "cobbles").reduce((sum, segment) => sum + segment.distanceKm, 0)).toBe(16);
    expect(isLikelyMassSprint(route)).toBe(true);
    expect(getRoadFinishMode(route, 40)).toBe("mass_sprint");
    expect(source.segments.every(segment => segment.cobblesStyle === undefined)).toBe(true);
  });

  it("makes sprinters competitive without a rule that ranks by rider profile", () => {
    let sprintWins = 0;
    const leadingGroupSizes: number[] = [];
    for (let seed = 0; seed < 16; seed++) {
      const source = input(seed);
      const result = simulateRaceStage(source);
      const winner = result.resolvedRiders.find(row => row.id === result.results[0].riderId)!;
      sprintWins += winner.ratings.sprint >= 85 ? 1 : 0;
      expect(result.roadFinishMode).toBe("mass_sprint");
      expect(result.results).toHaveLength(40);
      expect(new Set(result.results.map(row => row.riderId)).size).toBe(40);
      expect(result.results.every(row => Number.isFinite(row.elapsedTimeSeconds) && row.energyAfter >= 0 && row.energyAfter <= 100)).toBe(true);
      const leaderGroup = result.timeline.at(-1)!.groups.find(group => group.gapToLeaderSeconds === 0)!;
      leadingGroupSizes.push(leaderGroup.riderIds.length);
      expect(result.visualTimeline?.at(-1)?.groups).toEqual(result.timeline.at(-1)?.groups);
    }
    expect(sprintWins).toBeGreaterThanOrEqual(12);
    expect(Math.max(...leadingGroupSizes)).toBeGreaterThanOrEqual(30);
  });

  it("does not guarantee a victory to an exhausted sprinter", () => {
    const source = input();
    source.riders = source.riders.map(row => row.role === "leader_sprinter" ? { ...row, form: 5, ratings: { ...row.ratings, endurance: 20, resistance: 20 } } : row);
    const result = simulateRaceStage(source);
    expect(result.resolvedRiders.find(row => row.id === result.results[0].riderId)?.role).not.toBe("leader_sprinter");
  });

  it("resolves automatic sprint roles before tactics while respecting explicit support missions", () => {
    const source = input();
    source.riders = source.riders.map(row => ({ ...row, role: "auto" }));
    source.riders = source.riders.map(row => row.id === "urban-0-4" ? { ...row, raceDuty: "protector" } : row);
    source.teamStrategies![0] = { ...source.teamStrategies![0], protectorRiderId: "urban-0-4" };
    const result = simulateRaceStage(source);
    const own = result.resolvedRiders.filter(row => row.teamId === "team-0");
    expect(own.some(row => row.role === "leader_sprinter")).toBe(true);
    expect(own.some(row => row.role === "leadout")).toBe(true);
    expect(own.find(row => row.id === "urban-0-4")).toMatchObject({ raceDuty: "protector" });
    expect(own.find(row => row.id === "urban-0-4")?.role).not.toBe("leader_sprinter");
  });

  it("keeps paved incident risks and does not mutate the supplied course or instructions", () => {
    const source = input();
    const before = structuredClone(source);
    const route = normalizeUrbanCobblesSegments(source);
    const paved = route.at(-1)!;
    const ordinaryPaved: RaceStageSegment = { ...paved, cobblesStyle: undefined };
    expect(getRoadCrashRiskProfile({ segment: paved, weather: source.weather!, finalMassSprint: false, pelotonSize: 40 }))
      .toEqual(getRoadCrashRiskProfile({ segment: ordinaryPaved, weather: source.weather!, finalMassSprint: false, pelotonSize: 40 }));
    const first = simulateRaceStage(source);
    expect(simulateRaceStage(source)).toEqual(first);
    expect(source).toEqual(before);
  });

  it("still executes an explicit final attack instead of cancelling it for the sprint", () => {
    const source = input();
    source.teamStrategies![0].attackOrders = [{ riderId: "urban-0-0", segmentNumber: 18, intensity: "strong", condition: "always" }];
    const original = structuredClone(source.teamStrategies);
    const result = simulateRaceStage(source);
    expect(result.timeline.at(-1)!.commentary.some(line => line.includes("Rider 0-0") && line.includes("attaque préparée"))).toBe(true);
    expect(source.teamStrategies).toEqual(original);
  });

  it("uses the frozen sporting finish type for new visuals and preserves the legacy fallback", () => {
    const result = simulateRaceStage(input());
    expect(isMassGroupFinish(result)).toBe(true);
    expect(isMassGroupFinish({ ...result, roadFinishMode: "selective" })).toBe(false);
    expect(isMassGroupFinish({ ...result, roadFinishMode: "reduced_sprint" })).toBe(false);
    expect(isMassGroupFinish({ ...result, roadFinishMode: undefined })).toBe(true);
  });
});
