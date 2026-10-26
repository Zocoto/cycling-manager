import { describe, expect, it } from "vitest";

import {
  calculateSponsorMainObjectiveTerms,
  getSponsorMainObjectiveCandidateScore,
  selectSponsorMainObjectiveOfferId,
  SPONSOR_MAIN_OBJECTIVE_BUDGET_CAP_START_GAME_YEAR,
} from "./sponsor-main-objective";

describe("sponsor main objective", () => {
  it("préserve le barème contractuel de la saison 4", () => {
    const modest = calculateSponsorMainObjectiveTerms({
      sponsorPrestige: 1,
      raceCategoryCode: "national",
      targetRank: 10,
      targetSeasonGameYear: 4,
      annualSponsorBudget: 100_000,
    });
    const elite = calculateSponsorMainObjectiveTerms({
      sponsorPrestige: 5,
      raceCategoryCode: "elite",
      targetRank: 1,
      targetSeasonGameYear: 4,
      annualSponsorBudget: 100_000,
    });

    expect(modest).toEqual({ cashReward: 90_000, reputationPenalty: 20 });
    expect(elite).toEqual({ cashReward: 755_000, reputationPenalty: 80 });
  });

  it("conserve notamment les 460 000 € et 60 points du cas Kaffa Origins en saison 4", () => {
    expect(calculateSponsorMainObjectiveTerms({
      sponsorPrestige: 4,
      raceCategoryCode: "world",
      targetRank: 1,
      targetSeasonGameYear: 4,
      annualSponsorBudget: 1_034_000,
    })).toEqual({ cashReward: 460_000, reputationPenalty: 60 });
  });

  it("active le plafonnement seulement à partir de la saison 5", () => {
    expect(SPONSOR_MAIN_OBJECTIVE_BUDGET_CAP_START_GAME_YEAR).toBe(5);
  });

  it.each([5, 6])("plafonne une victoire à 15 %% du budget et réduit le risque en saison %i", season => {
    expect(calculateSponsorMainObjectiveTerms({
      sponsorPrestige: 4,
      raceCategoryCode: "world",
      targetRank: 1,
      targetSeasonGameYear: season,
      annualSponsorBudget: 1_034_000,
    })).toEqual({ cashReward: 155_000, reputationPenalty: 20 });
  });

  it.each([
    { rank: 2, reward: 125_000, penalty: 18 },
    { rank: 3, reward: 125_000, penalty: 18 },
    { rank: 4, reward: 100_000, penalty: 16 },
    { rank: 10, reward: 100_000, penalty: 16 },
  ])("plafonne le rang $rank selon son palier et réduit sa pénalité", ({ rank, reward, penalty }) => {
    expect(calculateSponsorMainObjectiveTerms({
      sponsorPrestige: 4,
      raceCategoryCode: "world",
      targetRank: rank,
      targetSeasonGameYear: 5,
      annualSponsorBudget: 1_034_000,
    })).toEqual({ cashReward: reward, reputationPenalty: penalty });
  });

  it("n’augmente pas une récompense historique déjà inférieure au plafond", () => {
    expect(calculateSponsorMainObjectiveTerms({
      sponsorPrestige: 1,
      raceCategoryCode: "national",
      targetRank: 10,
      targetSeasonGameYear: 5,
      annualSponsorBudget: 10_000_000,
    })).toEqual({ cashReward: 90_000, reputationPenalty: 20 });
  });

  it("conserve une récompense positive et un risque minimal pour les petits budgets", () => {
    expect(calculateSponsorMainObjectiveTerms({
      sponsorPrestige: 4,
      raceCategoryCode: "world",
      targetRank: 1,
      targetSeasonGameYear: 5,
      annualSponsorBudget: 50,
    })).toEqual({ cashReward: 7.5, reputationPenalty: 1 });
  });

  it.each([
    { budget: 49_999.99, expected: 4_999.99 },
    { budget: 50_000, expected: 5_000 },
    { budget: 99_999.99, expected: 5_000 },
    { budget: 100_000, expected: 10_000 },
  ])("arrondit toujours sous le plafond avec un budget de $budget €", ({ budget, expected }) => {
    const terms = calculateSponsorMainObjectiveTerms({
      sponsorPrestige: 4,
      raceCategoryCode: "world",
      targetRank: 10,
      targetSeasonGameYear: 5,
      annualSponsorBudget: budget,
    });
    expect(terms.cashReward).toBe(expected);
    expect(terms.cashReward).toBeLessThanOrEqual(budget * 0.1);
  });

  it("respecte les plafonds et ne renforce jamais la prime ni la pénalité sur tous les profils", () => {
    for (const raceCategoryCode of ["local", "regional", "national", "continental", "world", "elite"] as const) {
      for (const sponsorPrestige of [1, 2, 3, 4, 5] as const) {
        for (const [targetRank, capFraction] of [[1, 0.15], [2, 0.125], [3, 0.125], [4, 0.1], [10, 0.1]]) {
          for (const annualSponsorBudget of [50, 10_000, 250_000, 1_034_000, 10_000_000]) {
            const context = { sponsorPrestige, raceCategoryCode, targetRank, annualSponsorBudget };
            const legacy = calculateSponsorMainObjectiveTerms({ ...context, targetSeasonGameYear: 4 });
            const next = calculateSponsorMainObjectiveTerms({ ...context, targetSeasonGameYear: 5 });
            expect(next.cashReward).toBeGreaterThan(0);
            expect(next.cashReward).toBeLessThanOrEqual(annualSponsorBudget * capFraction);
            expect(next.cashReward).toBeLessThanOrEqual(legacy.cashReward);
            expect(next.reputationPenalty).toBeGreaterThanOrEqual(1);
            expect(next.reputationPenalty).toBeLessThanOrEqual(legacy.reputationPenalty);
          }
        }
      }
    }
  });

  it.each([0, -1, 4.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuse une saison invalide : %s",
    targetSeasonGameYear => {
      expect(() => calculateSponsorMainObjectiveTerms({
        sponsorPrestige: 4, raceCategoryCode: "world", targetRank: 1,
        targetSeasonGameYear, annualSponsorBudget: 1_034_000,
      })).toThrow();
    },
  );

  it.each([4, 5].flatMap(season => [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
    .map(budget => ({ season, budget }))))("refuse un budget invalide en saison $season : $budget", ({ season, budget }) => {
    expect(() => calculateSponsorMainObjectiveTerms({
      sponsorPrestige: 4, raceCategoryCode: "world", targetRank: 1,
      targetSeasonGameYear: season, annualSponsorBudget: budget,
    })).toThrow();
  });

  it("refuse un budget dont le plafond ne permet même pas un centime", () => {
    expect(() => calculateSponsorMainObjectiveTerms({
      sponsorPrestige: 4, raceCategoryCode: "world", targetRank: 1,
      targetSeasonGameYear: 5, annualSponsorBudget: 0.01,
    })).toThrow();
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
