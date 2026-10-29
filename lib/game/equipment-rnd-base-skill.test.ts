import { describe, expect, it } from "vitest";
import { getEquipmentRndModerateSuccessChance } from "./equipment-rnd-base-skill";
import { getEquipmentRndModerateSuccessChancePercentage } from "./equipment-rnd";
import { describeStaffEffect } from "./staff";
import { translateUiText } from "@/lib/i18n/ui-translations";

describe("engineer moderate success base skill", () => {
  it.each([[1, 5], [2, 10], [3, 15], [4, 20], [5, 25], [9, 25], [0, 5], [NaN, 5]])(
    "gives level %s a %s percent chance independently of talents",
    (level, chance) => {
      expect(getEquipmentRndModerateSuccessChance(level)).toBe(chance);
      expect(describeStaffEffect({ role: "research_engineer", level })[0])
        .toContain(`Succès modéré : ${chance} %`);
    },
  );

  it("keeps the launch profile authoritative, including old projects with no base skill", () => {
    const engineer = { contractId: "e", name: "Ada", level: 5, specialties: [], specialty: null };
    expect(getEquipmentRndModerateSuccessChancePercentage(engineer)).toBe(25);
    expect(getEquipmentRndModerateSuccessChancePercentage({ ...engineer, moderateSuccessChancePercentage: 10 })).toBe(10);
    expect(getEquipmentRndModerateSuccessChancePercentage({ ...engineer, moderateSuccessChancePercentage: 0 })).toBe(0);
  });

  it("explains the conditional chance and both distributions in English", () => {
    const description = describeStaffEffect({ role: "research_engineer", level: 4 })[0];
    expect(translateUiText(description)).toBe("Moderate success: 20% of successful research trials grant +2 to one attribute or +1 to two attributes in the chosen field, within the overall +10 cap");
  });
});
