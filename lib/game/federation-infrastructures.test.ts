import { describe, expect, it } from "vitest";

import {
  FEDERATION_INFRASTRUCTURE_CODES,
  FEDERATION_INFRASTRUCTURE_DEFINITIONS,
  MAX_FEDERATION_PROJECT_ARCHITECTS,
  calculateFederationConstructionPreview,
} from "@/lib/game/federation-infrastructures";

describe("federation infrastructures", () => {
  it("keeps the complete nine-building, five-level catalogue", () => {
    expect(FEDERATION_INFRASTRUCTURE_DEFINITIONS).toHaveLength(9);
    expect(new Set(FEDERATION_INFRASTRUCTURE_CODES)).toHaveProperty("size", 9);
    expect(
      FEDERATION_INFRASTRUCTURE_DEFINITIONS.every(
        (definition) => definition.levels.length === 5,
      ),
    ).toBe(true);
    expect(
      FEDERATION_INFRASTRUCTURE_DEFINITIONS.map(
        (definition) => definition.code,
      ),
    ).toEqual(FEDERATION_INFRASTRUCTURE_CODES);
  });

  it("caps architect contributions and never produces a negative quote", () => {
    const level = FEDERATION_INFRASTRUCTURE_DEFINITIONS[0].levels[4];
    const quote = calculateFederationConstructionPreview({
      level,
      architectCount: 99,
      priority: "cost",
    });

    expect(quote.architectCount).toBe(MAX_FEDERATION_PROJECT_ARCHITECTS);
    expect(quote.costReductionPercentage).toBe(20);
    expect(quote.cost).toBeGreaterThan(0);
    expect(quote.savedAmount).toBe(level.cost - quote.cost);
  });

  it("applies time and balanced priorities independently", () => {
    const level = FEDERATION_INFRASTRUCTURE_DEFINITIONS[2].levels[4];
    const fast = calculateFederationConstructionPreview({
      level,
      architectCount: 5,
      priority: "time",
    });
    const balanced = calculateFederationConstructionPreview({
      level,
      architectCount: 5,
      priority: "balanced",
    });

    expect(fast.cost).toBe(level.cost);
    expect(fast.durationReductionPercentage).toBe(30);
    expect(balanced.costReductionPercentage).toBe(10);
    expect(balanced.durationReductionPercentage).toBe(15);
  });
});
