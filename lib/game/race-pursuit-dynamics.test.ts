import { describe, expect, it } from "vitest";

import {
  evolveRacePursuitState,
  getPelotonBreakawayReleaseChance,
  getRacePursuitTargetPressure,
  INITIAL_RACE_PURSUIT_STATE,
  shouldResumePelotonChase,
  type PelotonBreakawayReleaseContext,
  type RacePursuitContext,
} from "./race-pursuit-dynamics";

const baseContext: RacePursuitContext = {
  raceProgress: 0.4,
  hasBreakaway: true,
  breakawayGapSeconds: 150,
  breakawayThreat: 0.35,
  chaseCapacity: 0.62,
  strategyModifier: 0,
  pelotonAverageEnergy: 62,
  breakawayAverageEnergy: 58,
  terrain: "flat",
  surface: "asphalt",
  isWet: false,
  likelyMassSprint: false,
  pelotonHasGivenUp: false,
};

const releaseContext: PelotonBreakawayReleaseContext = {
  isStageRace: true,
  hasEstablishedGeneralClassification: true,
  raceProgress: 0.58,
  tourProgress: 0.62,
  breakawaySize: 4,
  breakawayGapSeconds: 260,
  generalClassificationThreat: 0.05,
  generalClassificationStageInterest: 0.28,
  explicitChaseDemand: 0,
  pelotonAverageEnergy: 42,
  breakawayAverageEnergy: 55,
  likelyMassSprint: false,
};

describe("continuous race pursuit dynamics", () => {
  it("does not jump at the former early and late race thresholds", () => {
    const aroundThirty = [0.299, 0.301].map((raceProgress) =>
      getRacePursuitTargetPressure({ ...baseContext, raceProgress }),
    );
    const aroundSixtyTwo = [0.619, 0.621].map((raceProgress) =>
      getRacePursuitTargetPressure({ ...baseContext, raceProgress }),
    );

    expect(Math.abs(aroundThirty[1] - aroundThirty[0])).toBeLessThan(0.01);
    expect(Math.abs(aroundSixtyTwo[1] - aroundSixtyTwo[0])).toBeLessThan(0.01);
  });

  it("raises the chase when both the time gap and sporting threat increase", () => {
    const controlled = getRacePursuitTargetPressure(baseContext);
    const dangerous = getRacePursuitTargetPressure({
      ...baseContext,
      breakawayGapSeconds: 360,
      breakawayThreat: 0.9,
    });

    expect(dangerous).toBeGreaterThan(controlled + 0.2);
  });

  it("keeps team instructions, energy, terrain and weather in the decision", () => {
    const favorable = getRacePursuitTargetPressure({
      ...baseContext,
      strategyModifier: 0.1,
      pelotonAverageEnergy: 78,
      breakawayAverageEnergy: 42,
    });
    const difficult = getRacePursuitTargetPressure({
      ...baseContext,
      strategyModifier: -0.08,
      pelotonAverageEnergy: 38,
      breakawayAverageEnergy: 72,
      terrain: "climb",
      surface: "cobbles",
      isWet: true,
    });

    expect(favorable).toBeGreaterThan(difficult + 0.25);
  });

  it("uses inertia early but reacts faster during the finale", () => {
    const early = evolveRacePursuitState({
      previousState: INITIAL_RACE_PURSUIT_STATE,
      context: {
        ...baseContext,
        raceProgress: 0.2,
        breakawayGapSeconds: 330,
        breakawayThreat: 0.85,
      },
    });
    const late = evolveRacePursuitState({
      previousState: INITIAL_RACE_PURSUIT_STATE,
      context: {
        ...baseContext,
        raceProgress: 0.9,
        breakawayGapSeconds: 330,
        breakawayThreat: 0.85,
      },
    });

    expect(early.pressure).toBeLessThan(early.targetPressure);
    expect(late.pressure).toBeGreaterThan(early.pressure);
    expect(late.phase).toBe("all_in");
  });

  it("settles into observation when no breakaway remains", () => {
    const state = evolveRacePursuitState({
      previousState: { pressure: 0.75, targetPressure: 0.75, phase: "chase" },
      context: { ...baseContext, hasBreakaway: false },
    });

    expect(state.pressure).toBeLessThan(0.75);
    expect(state.phase).toBe("watching");
  });
});

describe("stage-race breakaway release", () => {
  it("can let a single harmless attacker go without a size threshold", () => {
    const soloChance = getPelotonBreakawayReleaseChance({
      ...releaseContext,
      breakawaySize: 1,
    });
    const largeGroupChance = getPelotonBreakawayReleaseChance({
      ...releaseContext,
      breakawaySize: 12,
    });

    expect(soloChance).toBeGreaterThan(0);
    expect(largeGroupChance).toBeGreaterThan(soloChance);
  });

  it("keeps the chase when the break threatens GC or a DS explicitly controls", () => {
    const safeChance = getPelotonBreakawayReleaseChance(releaseContext);
    const dangerousChance = getPelotonBreakawayReleaseChance({
      ...releaseContext,
      generalClassificationThreat: 0.9,
    });
    const orderedChaseChance = getPelotonBreakawayReleaseChance({
      ...releaseContext,
      explicitChaseDemand: 1,
    });

    expect(dangerousChance).toBeLessThan(safeChance);
    expect(orderedChaseChance).toBe(0);
    expect(
      shouldResumePelotonChase({
        generalClassificationThreat: 0.1,
        explicitChaseDemand: 0.9,
      }),
    ).toBe(true);
  });

  it("does not manufacture a tactical release before GC exists", () => {
    expect(
      getPelotonBreakawayReleaseChance({
        ...releaseContext,
        hasEstablishedGeneralClassification: false,
      }),
    ).toBe(0);
    expect(
      getPelotonBreakawayReleaseChance({
        ...releaseContext,
        isStageRace: false,
      }),
    ).toBe(0);
  });

  it("makes a sprint stage much harder for the break than a transition day", () => {
    const transitionChance = getPelotonBreakawayReleaseChance(releaseContext);
    const sprintChance = getPelotonBreakawayReleaseChance({
      ...releaseContext,
      generalClassificationStageInterest: 0.08,
      likelyMassSprint: true,
    });

    expect(transitionChance).toBeGreaterThan(sprintChance + 0.05);
  });
});
