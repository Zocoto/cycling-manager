import { describe, expect, it } from "vitest";

import {
  RIDER_SPECIAL_ABILITIES,
  SPECIAL_ABILITY_CATALOG,
  getSpecialAbilityDefinition,
  applyMetronomeToRaceDaySwing,
  doesCyclocrossmanAvoidCobbledCrash,
  getCyclocrossmanTerrainBonus,
  getPistardTimeTrialBonus,
  hasSpecialAbility,
  isRiderSpecialAbility,
  reduceThreeLungsFormLoss,
} from "./special-abilities";

describe("special abilities", () => {
  it("décrit exactement les quatorze médaillons connus", () => {
    expect(SPECIAL_ABILITY_CATALOG.map((ability) => ability.code)).toEqual(
      RIDER_SPECIAL_ABILITIES,
    );
    expect(SPECIAL_ABILITY_CATALOG).toHaveLength(14);
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
    expect(
      SPECIAL_ABILITY_CATALOG.find((ability) => ability.code === "pistard")
        ?.effect,
    ).toContain("25 km");
    expect(
      SPECIAL_ABILITY_CATALOG.find(
        (ability) => ability.code === "three_lungs",
      )?.effect,
    ).toContain("4 points");
  });

  it("reconnaît une capacité historique ou une capacité parmi plusieurs", () => {
    expect(getSpecialAbilityDefinition(" panache ")?.name).toBe("Panache");
    expect(getSpecialAbilityDefinition("panache")?.effect).toContain(
      "échappée",
    );
    expect(getSpecialAbilityDefinition("unknown_ability")).toBeNull();
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

  it("réserve le bonus Pistard aux chronos courts", () => {
    expect(getPistardTimeTrialBonus({ hasPistard: true, distanceKm: 12 })).toBe(
      3,
    );
    expect(getPistardTimeTrialBonus({ hasPistard: true, distanceKm: 25 })).toBe(
      2,
    );
    expect(getPistardTimeTrialBonus({ hasPistard: true, distanceKm: 26 })).toBe(
      0,
    );
    expect(
      getPistardTimeTrialBonus({ hasPistard: false, distanceKm: 8 }),
    ).toBe(0);
  });

  it("plafonne la protection de forme de Trois poumons", () => {
    expect(
      reduceThreeLungsFormLoss({ hasThreeLungs: true, formDelta: -25 }),
    ).toBe(-21);
    expect(
      reduceThreeLungsFormLoss({ hasThreeLungs: true, formDelta: -15 }),
    ).toBe(-11.3);
    expect(
      reduceThreeLungsFormLoss({ hasThreeLungs: true, formDelta: -1 }),
    ).toBe(-1);
    expect(
      reduceThreeLungsFormLoss({ hasThreeLungs: true, formDelta: 2 }),
    ).toBe(2);
  });

  it("cible les terrains techniques de Cyclocrossman", () => {
    expect(
      getCyclocrossmanTerrainBonus({
        hasCyclocrossman: true,
        terrain: "flat",
        surface: "cobbles",
        distanceKm: 10,
        averageGradientPct: 0,
      }),
    ).toBe(3);
    expect(
      getCyclocrossmanTerrainBonus({
        hasCyclocrossman: true,
        terrain: "climb",
        surface: "asphalt",
        distanceKm: 8,
        averageGradientPct: 7,
      }),
    ).toBe(3);
    expect(
      getCyclocrossmanTerrainBonus({
        hasCyclocrossman: true,
        terrain: "climb",
        surface: "asphalt",
        distanceKm: 18,
        averageGradientPct: 8,
      }),
    ).toBe(0);
    expect(
      doesCyclocrossmanAvoidCobbledCrash({
        hasCyclocrossman: true,
        isCobbled: true,
        roll: 0.19,
      }),
    ).toBe(true);
    expect(
      doesCyclocrossmanAvoidCobbledCrash({
        hasCyclocrossman: true,
        isCobbled: true,
        roll: 0.2,
      }),
    ).toBe(false);
  });

  it("Métronome amortit seulement les mauvais jours", () => {
    expect(applyMetronomeToRaceDaySwing({ hasMetronome: true, swing: -5 })).toBe(
      -2.5,
    );
    expect(applyMetronomeToRaceDaySwing({ hasMetronome: true, swing: 5 })).toBe(
      5,
    );
    expect(
      applyMetronomeToRaceDaySwing({ hasMetronome: false, swing: -5 }),
    ).toBe(-5);
  });
});
