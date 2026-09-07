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
      "federation-performance",
      "federation-staff",
      "daily-reward",
      "first-in-class",
    ]);
    expect(breakdown.totalPercentage).toBe(229.7);
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
