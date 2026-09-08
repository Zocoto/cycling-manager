import { describe, expect, it } from "vitest";

import { buildTrainingBonusBreakdown } from "./training-bonus-breakdown";

describe("training bonus breakdown", () => {
  it("reproduit l’empilement du moteur pour une statistique éligible", () => {
    const breakdown = buildTrainingBonusBreakdown({
      ratingKey: "mountain",
      trainerLevel: 5,
      trainerSpecialty: "mountain",
      trainerCountryMatch: true,
      trainerTalentSpecialties: ["mountain"],
      trainerTalentNationalityMultiplier: 1.1,
      trainingCenterLevel: 5,
      trainingCenterEfficiencyBonusPercentage: 10,
      trainingCenterSpecializationCode: "elite_performance",
      currentRating: 80,
      federationPerformanceLevel: 5,
      federationStaffInstituteLevel: 5,
      trainerMatchesFederation: true,
      dailyRewardMultiplier: 1.2,
      hasFirstInClass: true,
    });

    expect(breakdown.items.map((item) => item.key)).toEqual([
      "trainer-specialty",
      "trainer-affinity",
      "trainer-talent-mountain",
      "training-center",
      "training-center-elite_performance",
      "federation-performance",
      "federation-staff",
      "daily-reward",
      "first-in-class",
    ]);
    expect(breakdown.totalPercentage).toBe(252.8);
  });

  it("affiche le cumul d’Individualisation sur une note secondaire faible", () => {
    const breakdown = buildTrainingBonusBreakdown({
      ratingKey: "acceleration",
      currentRating: 60,
      trainerLevel: 0,
      trainerSpecialty: null,
      trainerCountryMatch: false,
      trainingCenterLevel: 5,
      trainingCenterSpecializationCode: "individualization",
    });

    expect(
      breakdown.items.find(
        (item) => item.key === "training-center-individualization",
      )?.percentage,
    ).toBe(10);
  });

  it("n’affiche pas une spécialité qui ne soutient pas la note", () => {
    const breakdown = buildTrainingBonusBreakdown({
      ratingKey: "sprint",
      trainerLevel: 5,
      trainerSpecialty: "mountain",
      trainerCountryMatch: false,
    });

    expect(breakdown.items).toEqual([]);
    expect(breakdown.totalPercentage).toBe(0);
  });
});
