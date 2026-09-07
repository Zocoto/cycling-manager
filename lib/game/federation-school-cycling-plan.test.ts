import { describe, expect, it } from "vitest";

import {
  getSchoolCyclingPlanDeliveryGameYear,
  getSchoolCyclingPlanTransferPoints,
} from "./federation-school-cycling-plan";

describe("federal school cycling plan", () => {
  it("reste sans effet pendant ses 56 jours de déploiement", () => {
    expect(
      getSchoolCyclingPlanTransferPoints({
        completesGameDayIndex: 140,
        currentGameDayIndex: 139,
        currentGameYear: 4,
      }),
    ).toBe(0);
  });

  it("monte en puissance sur trois promotions", () => {
    expect(getSchoolCyclingPlanDeliveryGameYear(140)).toBe(5);
    expect(
      getSchoolCyclingPlanTransferPoints({
        completesGameDayIndex: 140,
        currentGameDayIndex: 140,
        currentGameYear: 5,
      }),
    ).toBe(3);
    expect(
      getSchoolCyclingPlanTransferPoints({
        completesGameDayIndex: 140,
        currentGameDayIndex: 168,
        currentGameYear: 6,
      }),
    ).toBe(6);
    expect(
      getSchoolCyclingPlanTransferPoints({
        completesGameDayIndex: 140,
        currentGameDayIndex: 196,
        currentGameYear: 7,
      }),
    ).toBe(10);
    expect(
      getSchoolCyclingPlanTransferPoints({
        completesGameDayIndex: 140,
        currentGameDayIndex: 224,
        currentGameYear: 8,
      }),
    ).toBe(10);
  });
});
