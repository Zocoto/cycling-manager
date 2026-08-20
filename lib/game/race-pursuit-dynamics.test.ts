import { describe, expect, it } from "vitest";

import {
  evolveRacePursuitState,
  getRacePursuitTargetPressure,
  INITIAL_RACE_PURSUIT_STATE,
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
