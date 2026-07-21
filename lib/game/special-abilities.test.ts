import { describe, expect, it } from "vitest";

import {
  RIDER_SPECIAL_ABILITIES,
  SPECIAL_ABILITY_CATALOG,
  hasSpecialAbility,
  isRiderSpecialAbility,
} from "./special-abilities";

describe("special abilities", () => {
  it("décrit exactement les sept médaillons connus", () => {
    expect(SPECIAL_ABILITY_CATALOG.map((ability) => ability.code)).toEqual(
      RIDER_SPECIAL_ABILITIES
    );
    expect(SPECIAL_ABILITY_CATALOG).toHaveLength(7);
    expect(
      SPECIAL_ABILITY_CATALOG.find((ability) => ability.code === "sandwich_man")
        ?.effect
    ).toContain("+0,5 réputation");
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
