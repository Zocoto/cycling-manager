import { describe, expect, it } from "vitest";

import {
  DEFAULT_RIDER_MORALE,
  getRiderMoraleBand,
  getRiderMoraleExecutionBias,
  getRiderMoraleLabel,
  getRiderTimeTrialMoraleExecutionBias,
  normalizeRiderMorale,
} from "./rider-morale";

describe("rider morale", () => {
  it("normalizes missing and out-of-range values", () => {
    expect(normalizeRiderMorale(undefined)).toBe(DEFAULT_RIDER_MORALE);
    expect(normalizeRiderMorale(-12)).toBe(0);
    expect(normalizeRiderMorale(115)).toBe(100);
  });

  it("exposes stable, player-facing bands", () => {
    expect(getRiderMoraleBand(24)).toBe("dejected");
    expect(getRiderMoraleBand(25)).toBe("fragile");
    expect(getRiderMoraleBand(64)).toBe("stable");
    expect(getRiderMoraleBand(65)).toBe("confident");
    expect(getRiderMoraleLabel(80)).toBe("Euphorique");
  });

  it("keeps morale neutral at 60 and bounded around race execution", () => {
    expect(getRiderMoraleExecutionBias(60)).toBe(0);
    expect(getRiderMoraleExecutionBias(0)).toBeGreaterThanOrEqual(-1.75);
    expect(getRiderMoraleExecutionBias(0)).toBeLessThan(-1.7);
    expect(getRiderMoraleExecutionBias(100)).toBeLessThanOrEqual(1.25);
    expect(getRiderMoraleExecutionBias(100)).toBeGreaterThan(1.15);
  });

  it("halves the influence in time trials", () => {
    expect(getRiderTimeTrialMoraleExecutionBias(20)).toBeCloseTo(
      getRiderMoraleExecutionBias(20) / 2,
      3,
    );
  });
});
