import type {SponsorSeasonReview, SponsorSeasonReviewObjective} from "@/lib/game/sponsor-season-review";
export function createSponsorSeasonReviewObjective(overrides: Partial<SponsorSeasonReviewObjective> = {}): SponsorSeasonReviewObjective {
  return {id: "objective", name: "Top 10 de la course", displayOrder: 1, status: "completed",
    targetDetails: {kind: "race_result", raceId: "race", raceEditionId: "edition-s4", raceSlug: "course", raceLabel: "La course", countryCode: "BE", achievementType: "top_n", targetRank: 10, requiredCount: 1},
    currentValue: 5, targetValue: 10, satisfactionPoints: 10, achievementLevel: "full", partialSatisfactionPoints: 0, partialAchievements: [], ...overrides};
}
export function createSponsorSeasonReview(overrides: Partial<SponsorSeasonReview> = {}): SponsorSeasonReview {
  return {gameYear: 4, currentGameYear: 5, sponsorName: "Sponsor précédent", currentSponsorName: "Sponsor précédent", sameContract: true,
    satisfactionScore: 98, previousBudget: 320000, currentBudget: 350720, currencyCode: "EUR", currentCurrencyCode: "EUR",
    objectives: [createSponsorSeasonReviewObjective()], objectivesAvailable: true, ...overrides};
}
