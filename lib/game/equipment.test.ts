import { describe, expect, it } from "vitest";

import {
  applyEquipmentRatingBonuses,
  combineEquipmentEffects,
  isEquipmentFrozenForToday,
} from "./equipment";
import type { RiderRatings } from "./rider-profile";

const ratings: RiderRatings = {
  mountain: 80,
  hills: 80,
  recovery: 80,
  endurance: 80,
  resistance: 80,
  breakaway: 80,
  downhill: 80,
  acceleration: 80,
  sprint: 80,
  flat: 80,
  cobbles: 80,
  prologue: 80,
  timeTrial: 99,
};

describe("equipment effects", () => {
  it("cumule les bonus de chaque pièce et plafonne la protection", () => {
    expect(
      combineEquipmentEffects([
        {
          ratingBonuses: { mountain: 2, acceleration: 1 },
          injuryRiskReductionPct: 30,
        },
        {
          ratingBonuses: { mountain: 1, timeTrial: 3 },
          injuryRiskReductionPct: 25,
          victoryReputationBonus: 0.2,
        },
      ])
    ).toEqual({
      ratingBonuses: { mountain: 3, acceleration: 1, timeTrial: 3 },
      timeTrialRatingBonuses: {},
      injuryRiskReductionPct: 45,
      breakawayReputationBonus: 0,
      victoryReputationBonus: 0.2,
    });
  });

  it("réserve les bonus contextuels aux chronos et prologues", () => {
    const effects = {
      ratingBonuses: {},
      timeTrialRatingBonuses: { endurance: 2 },
    };

    expect(applyEquipmentRatingBonuses(ratings, effects).endurance).toBe(80);
    expect(
      applyEquipmentRatingBonuses(ratings, effects, { isTimeTrial: true })
        .endurance
    ).toBe(82);
  });

  it("applique les bonus sans dépasser 100", () => {
    const boosted = applyEquipmentRatingBonuses(ratings, {
      ratingBonuses: { mountain: 2, timeTrial: 4 },
    });

    expect(boosted.mountain).toBe(82);
    expect(boosted.timeTrial).toBe(100);
  });

  it("gèle les changements à midi heure de Paris", () => {
    expect(isEquipmentFrozenForToday(new Date("2026-07-20T09:59:00Z"))).toBe(false);
    expect(isEquipmentFrozenForToday(new Date("2026-07-20T10:00:00Z"))).toBe(true);
  });
});
