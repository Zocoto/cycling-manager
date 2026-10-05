import { describe, expect, it } from "vitest";

import {
  calculateFederationFinancePreview,
  calculateFederationDivisionGrant,
  getFederationObjectiveLevel,
  getFederationSolidarityEligibleTeams,
} from "./federation-finance-preview";

describe("calculateFederationFinancePreview", () => {
  it.each([
    [0, "none"],
    [1, "bronze"],
    [2, "bronze"],
    [3, "silver"],
    [4, "silver"],
    [5, "gold"],
  ] as const)("maps %i completed objectives to %s", (count, expected) => {
    expect(getFederationObjectiveLevel(count)).toBe(expected);
  });

  it("rewards rank, Nations Cup division and real race participation", () => {
    const leadingNation = calculateFederationFinancePreview({
      nationRank: 1,
      division: 1,
      raceDays: 12,
      averageStarters: 160,
      donations: 0,
      objectiveLevel: "gold",
    });
    const developingNation = calculateFederationFinancePreview({
      nationRank: 173,
      division: 4,
      raceDays: 12,
      averageStarters: 40,
      donations: 0,
      objectiveLevel: "none",
    });

    expect(leadingNation.uciGrant).toBeGreaterThan(developingNation.uciGrant);
    expect(leadingNation.nationsCupGrant).toBeGreaterThan(
      developingNation.nationsCupGrant,
    );
    expect(leadingNation.raceRevenue).toBeGreaterThan(
      developingNation.raceRevenue,
    );
    expect(leadingNation.objectiveBonus).toBeGreaterThan(0);
  });

  it("keeps every sandbox input inside safe preview limits", () => {
    const preview = calculateFederationFinancePreview({
      nationRank: -40,
      division: 9 as 4,
      raceDays: 1_000,
      averageStarters: 4_000,
      donations: 90_000_000,
      objectiveLevel: "gold",
    });

    expect(preview.uciGrant).toBe(1_000_000);
    expect(preview.nationsCupGrant).toBe(120_000);
    expect(preview.courseFillRate).toBe(1);
    expect(preview.donations).toBe(5_000_000);
  });

  it("exposes the enforced ten-percent solidarity ceiling", () => {
    const preview = calculateFederationFinancePreview({
      nationRank: 20,
      division: 1,
      raceDays: 8,
      averageStarters: 120,
      donations: 100_000,
      objectiveLevel: "silver",
    });

    expect(preview.solidarityEnvelope).toBe(
      Math.round((preview.totalRevenue * 0.1) / 5_000) * 5_000,
    );
  });
});

describe("season-four division and sporting-rank grants", () => {
  it.each([
    [1, 450_000], [2, 300_000], [3, 200_000], [4, 120_000],
  ] as const)("preserves the guaranteed D%i base of %i euros", (division, baseGrant) => {
    for (let nationRank = 1; nationRank <= 173; nationRank += 1) {
      const grant = calculateFederationDivisionGrant({ budgetGameYear: 4, division, nationRank });
      expect(grant.baseGrant).toBe(baseGrant);
      expect(grant.totalGrant).toBe(baseGrant + grant.rankingBonus);
      expect(grant.rankingBonus).toBeGreaterThanOrEqual(0);
      expect(grant.rankingBonus).toBeLessThanOrEqual(baseGrant);
    }
  });

  it.each([undefined, 1, 2, 3])("does not change any pre-S4 opening (%s)", (budgetGameYear) => {
    for (let nationRank = 1; nationRank <= 173; nationRank += 1) {
      const division = (nationRank <= 20 ? 1 : nationRank <= 60 ? 2 : nationRank <= 100 ? 3 : 4) as 1 | 2 | 3 | 4;
      const preview = calculateFederationFinancePreview({ budgetGameYear, nationRank, division, raceDays: 8, averageStarters: 120, donations: 0, objectiveLevel: "gold" });
      const baseGrant = { 1: 450_000, 2: 300_000, 3: 200_000, 4: 120_000 }[division];
      const uciGrant = Math.round((150_000 + 850_000 * Math.sqrt(1 - (nationRank - 1) / 172)) / 5_000) * 5_000;
      const structural = 1_200_000 + uciGrant + baseGrant;
      expect(preview.nationsCupGrant).toBe(baseGrant);
      expect(preview.nationRankingBonus).toBe(0);
      expect(preview.totalRevenue).toBe(structural + 112_000 + Math.round(structural * 0.1 / 5_000) * 5_000);
    }
  });

  it.each([
    [1, 450_000, 900_000], [2, 318_000, 768_000], [3, 260_000, 710_000],
    [5, 201_000, 651_000], [10, 142_000, 592_000], [20, 101_000, 551_000],
  ])("pays rank #%i its D1 base plus %i premium = %i", (nationRank, bonus, total) => {
    expect(calculateFederationDivisionGrant({ budgetGameYear: 4, division: 1, nationRank })).toEqual({ baseGrant: 450_000, rankingBonus: bonus, totalGrant: total });
  });

  it.each([1, 2, 3, 4] as const)("makes the D%i premium decrease and flatten with rank", (division) => {
    const grants = Array.from({ length: 173 }, (_, i) => calculateFederationDivisionGrant({ budgetGameYear: 4, division, nationRank: i + 1 }).rankingBonus);
    for (let i = 1; i < grants.length; i += 1) {
      expect(grants[i]).toBeLessThanOrEqual(grants[i - 1]);
      // Nearest-1,000 rounding can move successive gaps by at most 1,000.
      if (i > 1) expect(grants[i - 1] - grants[i]).toBeLessThanOrEqual(grants[i - 2] - grants[i - 1] + 1_000);
    }
    expect(grants[0] - grants[1]).toBeGreaterThan(grants[1] - grants[2]);
  });

  it("counts the premium once, including in the objective-bonus base", () => {
    const preview = calculateFederationFinancePreview({ budgetGameYear: 4, nationRank: 1, division: 1, raceDays: 0, averageStarters: 0, donations: 0, objectiveLevel: "gold" });
    expect(preview.nationsCupBaseGrant).toBe(450_000);
    expect(preview.nationRankingBonus).toBe(450_000);
    expect(preview.objectiveBonus).toBe(310_000);
    expect(preview.totalRevenue).toBe(3_410_000);
    expect(calculateFederationFinancePreview({ budgetGameYear: 5, nationRank: 1, division: 1, raceDays: 0, averageStarters: 0, donations: 0, objectiveLevel: "gold" })).toEqual(preview);
  });

  it("does not award the maximum for an unknown rank or activate an invalid season", () => {
    expect(calculateFederationDivisionGrant({ budgetGameYear: 4, nationRank: Number.NaN, division: 1 }).rankingBonus).toBe(34_000);
    expect(calculateFederationDivisionGrant({ budgetGameYear: Number.NaN, nationRank: 1, division: 1 }).rankingBonus).toBe(0);
  });
});

describe("getFederationSolidarityEligibleTeams", () => {
  it("allows the president team", () => {
    expect(
      getFederationSolidarityEligibleTeams({
        teams: [
          {
            teamId: "solo-team",
            teamName: "Solo Team",
            reputationPoints: 75,
            solidarityReceived: 0,
          },
        ],
        reputationThreshold: 100,
        amountPerTeam: 25_000,
      }),
    ).toEqual([
      expect.objectContaining({
        teamId: "solo-team",
        grantAmount: 25_000,
      }),
    ]);
  });

  it("keeps the president eligible when another team is affiliated", () => {
    const eligibleTeams = getFederationSolidarityEligibleTeams({
      teams: [
        {
          teamId: "president-team",
          teamName: "President Team",
          reputationPoints: 50,
          solidarityReceived: 0,
        },
        {
          teamId: "member-team",
          teamName: "Member Team",
          reputationPoints: 80,
          solidarityReceived: 90_000,
        },
      ],
      reputationThreshold: 100,
      amountPerTeam: 25_000,
    });

    expect(eligibleTeams).toEqual([
      expect.objectContaining({
        teamId: "president-team",
        grantAmount: 25_000,
      }),
      expect.objectContaining({
        teamId: "member-team",
        grantAmount: 10_000,
      }),
    ]);
  });
});
