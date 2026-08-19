import { describe, expect, it } from "vitest";

import {
  STAFF_TALENT_DEFINITIONS,
  describeStaffTalent,
  getStaffTalentCodes,
  isStaffTalentForRole,
  selectInitialStaffTalent,
} from "@/lib/game/staff-talents";
import { STAFF_ROLES } from "@/lib/game/staff";

describe("staff talents", () => {
  it("defines at least three compatible talents for every staff role", () => {
    for (const role of STAFF_ROLES) {
      const codes = getStaffTalentCodes(role);
      expect(codes.length).toBeGreaterThanOrEqual(3);
      expect(
        codes.every((code) => STAFF_TALENT_DEFINITIONS[code].role === role),
      ).toBe(true);
    }
  });

  it("never gives a new trainer the same domain as the main specialty", () => {
    for (let roll = 0; roll < 30; roll += 1) {
      expect(
        selectInitialStaffTalent({
          role: "trainer",
          roll,
          trainerSpecialty: "mountain",
        }),
      ).not.toBe("trainer_mountain");
    }
  });

  it("keeps deterministic selection inside the requested role", () => {
    const code = selectInitialStaffTalent({
      role: "nutritionist",
      roll: 17,
    });

    expect(isStaffTalentForRole(code, "nutritionist")).toBe(true);
    expect(selectInitialStaffTalent({ role: "nutritionist", roll: 17 })).toBe(
      code,
    );
  });

  it("réserve le talent Double chantier aux architectes de niveau 3 minimum", () => {
    for (let roll = 0; roll < 20; roll += 1) {
      expect(
        selectInitialStaffTalent({
          role: "architect",
          staffLevel: 2,
          roll,
        }),
      ).not.toBe("architect_parallel_construction");
    }

    expect(
      Array.from({ length: 20 }, (_, roll) =>
        selectInitialStaffTalent({
          role: "architect",
          staffLevel: 3,
          roll,
        }),
      ),
    ).toContain("architect_parallel_construction");
  });

  it("présente les talents du nutritionniste comme des bonus supplémentaires", () => {
    expect(describeStaffTalent("nutrition_daily_form", 5)).toContain(
      "supplémentaire pour chaque coureur",
    );
    expect(
      describeStaffTalent("nutrition_supplement_effectiveness", 5),
    ).toContain("supplémentaire sur chaque complément");
  });
});
