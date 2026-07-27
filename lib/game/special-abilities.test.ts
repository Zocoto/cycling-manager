import { describe, expect, it } from "vitest";

import {
  RIDER_SPECIAL_ABILITIES,
  SPECIAL_ABILITY_CATALOG,
  hasSpecialAbility,
  isRiderSpecialAbility,
} from "./special-abilities";

describe("special abilities", () => {
  it("décrit exactement les dix médaillons connus", () => {
    expect(SPECIAL_ABILITY_CATALOG.map((ability) => ability.code)).toEqual(
      RIDER_SPECIAL_ABILITIES
    );
    expect(SPECIAL_ABILITY_CATALOG).toHaveLength(10);
    expect(
      SPECIAL_ABILITY_CATALOG.find((ability) => ability.code === "sandwich_man")
        ?.effect
    ).toContain("+0,5 réputation");
    expect(
      SPECIAL_ABILITY_CATALOG.find((ability) => ability.code === "iron_health")
        ?.effect,
    ).toContain("30 %");
    expect(
      SPECIAL_ABILITY_CATALOG.find(
        (ability) => ability.code === "first_in_class",
      )?.effect,
    ).toContain("50 %");
    const homegrownAbility = SPECIAL_ABILITY_CATALOG.find(
      (ability) => ability.code === "homegrown",
    );
    expect(homegrownAbility?.effect).toContain("+2");
    expect(homegrownAbility?.effect).toContain("non-renouvellement");
  });

  it("reconnaît une capacité historique ou une capacité parmi plusieurs", () => {
    expect(
      hasSpecialAbility({ specialAbility: "flahute" }, "flahute")
    ).toBe(true);
    expect(
      hasSpecialAbility(
        { specialAbilities: ["flahute", "sandwich_man"] },
        "sandwich_man"
      )
    ).toBe(true);
    expect(isRiderSpecialAbility("unknown_ability")).toBe(false);
  });
});
