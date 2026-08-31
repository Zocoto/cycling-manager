import { describe, expect, it } from "vitest";

import { calculateFederationFinancePreview } from "./federation-finance-preview";

describe("calculateFederationFinancePreview", () => {
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

  it("exposes balanced advisory envelopes without creating transactions", () => {
    const preview = calculateFederationFinancePreview({
      nationRank: 20,
      division: 1,
      raceDays: 8,
      averageStarters: 120,
      donations: 100_000,
      objectiveLevel: "silver",
    });

    const allocated =
      preview.reserveEnvelope +
      preview.infrastructureEnvelope +
      preview.solidarityEnvelope;

    expect(Math.abs(allocated - preview.totalRevenue)).toBeLessThanOrEqual(5_000);
  });
});
