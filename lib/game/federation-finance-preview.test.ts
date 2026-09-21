import { describe, expect, it } from "vitest";

import {
  calculateFederationFinancePreview,
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
