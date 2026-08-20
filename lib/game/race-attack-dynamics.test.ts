import { describe, expect, it } from "vitest";

import type { RaceStageSegment } from "./race-profiles";
import {
  DYNAMIC_COUNTER_ATTACK_COOLDOWN_KM,
  findBestDynamicAttackWindow,
  isDynamicAttackCooldownReady,
} from "./race-attack-dynamics";

function ticks(
  count: number,
  overrides: Partial<RaceStageSegment> = {},
): RaceStageSegment[] {
  return Array.from({ length: count }, (_, index) => ({
    distanceKm: 2,
    terrain: "flat",
    averageGradientPct: 0,
    surface: "asphalt",
    prime: null,
    ...overrides,
    segmentNumber: overrides.segmentNumber ?? index + 1,
  }));
}

describe("dynamic attack windows", () => {
  it("locates a counter-attack inside the authored segment", () => {
    const window = findBestDynamicAttackWindow({
      kind: "counter_attack",
      ticks: ticks(5),
      completedDistanceKm: 60,
      totalDistanceKm: 180,
      profileType: "hilly",
      breakawayGapSeconds: 110,
      chasePressure: 0.28,
      hasBreakaway: true,
      likelyMassSprint: false,
      isWet: false,
    });

    expect(window).not.toBeNull();
    expect(window!.atDistanceKm).toBeGreaterThan(60);
    expect(window!.atDistanceKm).toBeLessThan(70);
    expect(window!.tickIndex).toBeGreaterThanOrEqual(0);
  });

  it("rejects a bridge when there is no breakaway or the chase is already all-in", () => {
    const common = {
      kind: "counter_attack" as const,
      ticks: ticks(5),
      completedDistanceKm: 60,
      totalDistanceKm: 180,
      profileType: "hilly" as const,
      breakawayGapSeconds: 110,
      likelyMassSprint: false,
      isWet: false,
    };

    expect(
      findBestDynamicAttackWindow({
        ...common,
        chasePressure: 0.28,
        hasBreakaway: false,
      }),
    ).toBeNull();
    expect(
      findBestDynamicAttackWindow({
        ...common,
        chasePressure: 0.95,
        hasBreakaway: true,
      }),
    ).toBeNull();
  });

  it("opens a decisive window late on selective terrain but not on a flat mass-sprint", () => {
    const selective = findBestDynamicAttackWindow({
      kind: "decisive_attack",
      ticks: ticks(5, {
        terrain: "climb",
        averageGradientPct: 7,
      }),
      completedDistanceKm: 140,
      totalDistanceKm: 180,
      profileType: "mountain",
      breakawayGapSeconds: 0,
      chasePressure: 0.72,
      hasBreakaway: false,
      likelyMassSprint: false,
      isWet: false,
    });
    const sprint = findBestDynamicAttackWindow({
      kind: "decisive_attack",
      ticks: ticks(5),
      completedDistanceKm: 140,
      totalDistanceKm: 180,
      profileType: "flat",
      breakawayGapSeconds: 0,
      chasePressure: 0.72,
      hasBreakaway: false,
      likelyMassSprint: true,
      isWet: false,
    });

    expect(selective?.opportunity).toBeGreaterThan(0.7);
    expect(sprint).toBeNull();
  });

  it("leaves very short efforts to the base effort model", () => {
    expect(
      findBestDynamicAttackWindow({
        kind: "decisive_attack",
        ticks: ticks(5, {
          terrain: "climb",
          averageGradientPct: 8,
        }),
        completedDistanceKm: 20,
        totalDistanceKm: 30,
        profileType: "mountain",
        breakawayGapSeconds: 0,
        chasePressure: 0.72,
        hasBreakaway: false,
        likelyMassSprint: false,
        isWet: false,
      }),
    ).toBeNull();
  });

  it("expresses cooldowns in kilometres instead of authored segment counts", () => {
    const window = {
      kind: "counter_attack" as const,
      tickIndex: 2,
      atDistanceKm: 82,
      remainingDistanceKm: 98,
      raceProgress: 82 / 180,
      opportunity: 0.7,
    };

    expect(
      isDynamicAttackCooldownReady({
        window,
        lastAttackAtKm: 74,
        cooldownKm: DYNAMIC_COUNTER_ATTACK_COOLDOWN_KM,
      }),
    ).toBe(false);
    expect(
      isDynamicAttackCooldownReady({
        window,
        lastAttackAtKm: 68,
        cooldownKm: DYNAMIC_COUNTER_ATTACK_COOLDOWN_KM,
      }),
    ).toBe(true);
  });
});
