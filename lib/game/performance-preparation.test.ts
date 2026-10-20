import { describe, expect, it } from "vitest";

import {
  getPerformancePreparationPolicy,
  PERFORMANCE_PREPARATION_DAYS,
} from "./performance-preparation";

describe("performance preparation balance", () => {
  it("keeps the two-day preparation and improves every level without reducing duration", () => {
    expect(PERFORMANCE_PREPARATION_DAYS).toBe(2);
    const policies = [1, 2, 3, 4, 5].map((level) => getPerformancePreparationPolicy(level)!);
    expect(policies.map((policy) => policy.ratingBonus)).toEqual([1, 1.5, 2, 2.5, 3]);
    expect(policies.map((policy) => policy.bonusDays)).toEqual([3, 4, 4, 5, 6]);
    expect(policies.map((policy) => policy.capacity)).toEqual([1, 1, 2, 2, 3]);
    for (let index = 1; index < policies.length; index += 1) {
      expect(policies[index].ratingBonus).toBeGreaterThan(policies[index - 1].ratingBonus);
      expect(policies[index].bonusDays).toBeGreaterThanOrEqual(policies[index - 1].bonusDays);
      expect(policies[index].capacity).toBeGreaterThanOrEqual(policies[index - 1].capacity);
    }
  });

  it.each([0, -1, 6, 1.5, NaN, Infinity])("does not unlock a facility for invalid level %s", (level) => {
    expect(getPerformancePreparationPolicy(level)).toBeNull();
  });
});
