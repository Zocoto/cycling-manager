import { describe, expect, it } from "vitest";

import { buildStackedBonusBreakdown } from "./bonus-breakdown";

describe("stacked bonus breakdown", () => {
  it("additionne une famille avant d’empiler les multiplicateurs", () => {
    const breakdown = buildStackedBonusBreakdown([
      {
        key: "trainer",
        label: "Entraîneur",
        percentage: 20,
        stackingGroup: "trainer-base",
      },
      {
        key: "affinity",
        label: "Affinité",
        percentage: 10,
        stackingGroup: "trainer-base",
      },
      { key: "building", label: "Bâtiment", percentage: 10 },
    ]);

    expect(breakdown.totalPercentage).toBe(43);
    expect(breakdown.items).toHaveLength(3);
  });

  it("compose correctement plusieurs réductions", () => {
    expect(
      buildStackedBonusBreakdown([
        { key: "scout", label: "Scout", percentage: -10 },
        { key: "federation", label: "Fédération", percentage: -5 },
      ]).totalPercentage,
    ).toBe(-14.5);
  });

  it("écarte les valeurs nulles et non finies", () => {
    const breakdown = buildStackedBonusBreakdown([
      { key: "none", label: "Aucun", percentage: 0 },
      { key: "invalid", label: "Invalide", percentage: Number.NaN },
    ]);

    expect(breakdown).toEqual({
      totalPercentage: 0,
      items: [],
      calculation: "stacked",
    });
  });
});
