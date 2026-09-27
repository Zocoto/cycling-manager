import { describe, expect, it } from "vitest";

import {
  calculateSponsorMainObjectiveTerms,
  getSponsorMainObjectiveCandidateScore,
  selectSponsorMainObjectiveOfferId,
} from "./sponsor-main-objective";

describe("sponsor main objective", () => {
  it("augmente nettement la prime et le risque avec le prestige et la catégorie", () => {
    const modest = calculateSponsorMainObjectiveTerms({
      sponsorPrestige: 1,
      raceCategoryCode: "national",
      targetRank: 10,
    });
    const elite = calculateSponsorMainObjectiveTerms({
      sponsorPrestige: 5,
      raceCategoryCode: "elite",
      targetRank: 1,
    });

    expect(modest).toEqual({ cashReward: 90_000, reputationPenalty: 20 });
    expect(elite).toEqual({ cashReward: 755_000, reputationPenalty: 80 });
  });

  it("privilégie la course la plus prestigieuse puis l’objectif le plus exigeant", () => {
    expect(
      getSponsorMainObjectiveCandidateScore({
        raceCategoryCode: "world",
        targetRank: 10,
      }),
    ).toBeGreaterThan(
      getSponsorMainObjectiveCandidateScore({
        raceCategoryCode: "continental",
        targetRank: 1,
      }),
    );
    expect(
      getSponsorMainObjectiveCandidateScore({
        raceCategoryCode: "elite",
        targetRank: 1,
      }),
    ).toBeGreaterThan(
      getSponsorMainObjectiveCandidateScore({
        raceCategoryCode: "elite",
        targetRank: 5,
      }),
    );
  });

  it("ne retient qu’une offre sur un lot de trois et environ un contrat isolé sur trois", () => {
    const offerIds = ["offer-a", "offer-b", "offer-c"];
    expect(offerIds).toContain(
      selectSponsorMainObjectiveOfferId(offerIds, "season-4"),
    );

    const selectedCount = Array.from({ length: 300 }, (_, index) =>
      selectSponsorMainObjectiveOfferId(["continuing-offer"], `season-${index}`),
    ).filter(Boolean).length;
    expect(selectedCount).toBeGreaterThanOrEqual(80);
    expect(selectedCount).toBeLessThanOrEqual(120);
  });
});
