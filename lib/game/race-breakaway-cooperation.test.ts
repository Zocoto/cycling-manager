import { describe, expect, it } from "vitest";

import type { RaceStageSegment } from "./race-profiles";
import {
  INITIAL_BREAKAWAY_COOPERATION_STATE,
  evolveBreakawayCooperation,
  type BreakawayRelayCandidate,
} from "./race-breakaway-cooperation";

const flatSegment = {
  segmentNumber: 3,
  distanceKm: 2,
  terrain: "flat",
  averageGradientPct: 0,
  surface: "asphalt",
  prime: null,
} satisfies RaceStageSegment;

function candidates(count: number): BreakawayRelayCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    riderId: `rider-${index + 1}`,
    teamId: `team-${index + 1}`,
    energy: 68,
    breakawayRating: 68,
    enduranceRating: 70,
    role: "free_agent",
    hasLocomotive: false,
    hasPanache: false,
  }));
}

describe("evolveBreakawayCooperation", () => {
  it("organizes a healthy group under pressure better than a tired late group", () => {
    const organized = evolveBreakawayCooperation({
      previousState: INITIAL_BREAKAWAY_COOPERATION_STATE,
      candidates: candidates(6),
      tickIndex: 5,
      raceProgress: 0.52,
      gapSeconds: 150,
      chasePressure: 0.78,
      segment: flatSegment,
      isWet: false,
      frontGroupIsYielding: false,
      frontGroupIsUncontested: false,
    });
    const tired = evolveBreakawayCooperation({
      previousState: INITIAL_BREAKAWAY_COOPERATION_STATE,
      candidates: candidates(18).map((candidate, index) => ({
        ...candidate,
        energy: index % 2 === 0 ? 12 : 46,
      })),
      tickIndex: 40,
      raceProgress: 0.9,
      gapSeconds: 460,
      chasePressure: 0.18,
      segment: flatSegment,
      isWet: false,
      frontGroupIsYielding: false,
      frontGroupIsUncontested: false,
    });

    expect(organized.cooperation).toBeGreaterThan(tired.cooperation);
    expect(organized.paceTimeMultiplier).toBeLessThan(
      tired.paceTimeMultiplier,
    );
  });

  it("rotates relay duty while keeping the average workload close to one", () => {
    const first = evolveBreakawayCooperation({
      previousState: INITIAL_BREAKAWAY_COOPERATION_STATE,
      candidates: candidates(6),
      tickIndex: 0,
      raceProgress: 0.45,
      gapSeconds: 180,
      chasePressure: 0.62,
      segment: flatSegment,
      isWet: false,
      frontGroupIsYielding: false,
      frontGroupIsUncontested: false,
    });
    const second = evolveBreakawayCooperation({
      previousState: first,
      candidates: candidates(6),
      tickIndex: 3,
      raceProgress: 0.48,
      gapSeconds: 170,
      chasePressure: 0.66,
      segment: flatSegment,
      isWet: false,
      frontGroupIsYielding: false,
      frontGroupIsUncontested: false,
    });
    const averageLoad =
      Object.values(first.relayLoadByRiderId).reduce(
        (total, load) => total + load,
        0,
      ) / 6;

    expect(new Set(first.activeRelayRiderIds)).not.toEqual(
      new Set(second.activeRelayRiderIds),
    );
    expect(averageLoad).toBeCloseTo(1, 5);
    expect(Math.min(...Object.values(first.relayLoadByRiderId))).toBeLessThan(
      1,
    );
    expect(Math.max(...Object.values(first.relayLoadByRiderId))).toBeGreaterThan(
      1,
    );
  });

  it("uses relay-oriented abilities without making them passive group bonuses", () => {
    const group = candidates(5).map((candidate, index) => ({
      ...candidate,
      energy: 62,
      breakawayRating: 62,
      enduranceRating: 62,
      role: "auto" as const,
      hasLocomotive: index === 4,
      hasPanache: index === 3,
    }));
    const state = evolveBreakawayCooperation({
      previousState: INITIAL_BREAKAWAY_COOPERATION_STATE,
      candidates: group,
      tickIndex: 4,
      raceProgress: 0.5,
      gapSeconds: 140,
      chasePressure: 0.72,
      segment: flatSegment,
      isWet: false,
      frontGroupIsYielding: false,
      frontGroupIsUncontested: false,
    });

    expect(state.activeRelayRiderIds).toContain("rider-5");
    expect(state.relayLoadByRiderId["rider-5"]).toBeGreaterThan(1);
  });

  it("stops assigning relays when the front group gives up", () => {
    const state = evolveBreakawayCooperation({
      previousState: INITIAL_BREAKAWAY_COOPERATION_STATE,
      candidates: candidates(8),
      tickIndex: 10,
      raceProgress: 0.42,
      gapSeconds: 60,
      chasePressure: 0.9,
      segment: flatSegment,
      isWet: false,
      frontGroupIsYielding: true,
      frontGroupIsUncontested: false,
    });

    expect(state.activeRelayRiderIds).toEqual([]);
    expect(new Set(Object.values(state.relayLoadByRiderId))).toEqual(
      new Set([1]),
    );
    expect(state.paceTimeMultiplier).toBeGreaterThan(1);
  });
});
