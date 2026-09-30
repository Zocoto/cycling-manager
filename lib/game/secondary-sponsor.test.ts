import { describe, expect, it } from "vitest";

import {
  calculateSecondarySponsorObjectiveReward,
  getSecondarySponsorEligibleCategoryCodes,
  getSecondarySponsorObjectiveCount,
  getSecondarySponsorTargetRank,
  normalizeSecondarySponsorLogoPlacement,
} from "./secondary-sponsor";

describe("secondary sponsor", () => {
  it("propose trois à cinq objectifs selon le prestige", () => {
    expect(getSecondarySponsorObjectiveCount(1)).toBe(3);
    expect(getSecondarySponsorObjectiveCount(2)).toBe(3);
    expect(getSecondarySponsorObjectiveCount(3)).toBe(4);
    expect(getSecondarySponsorObjectiveCount(4)).toBe(4);
    expect(getSecondarySponsorObjectiveCount(5)).toBe(5);
  });

  it("réserve les grandes catégories aux partenaires les plus prestigieux", () => {
    expect(getSecondarySponsorEligibleCategoryCodes(1)).toEqual([
      "national",
      "continental",
    ]);
    expect(getSecondarySponsorEligibleCategoryCodes(5)).toEqual([
      "continental",
      "world",
      "elite",
    ]);
  });

  it("rend les objectifs prestigieux plus exigeants sans produire de primes excessives", () => {
    const accessibleRank = getSecondarySponsorTargetRank({
      prestige: 1,
      categoryCode: "national",
      index: 0,
    });
    const eliteRank = getSecondarySponsorTargetRank({
      prestige: 5,
      categoryCode: "elite",
      index: 0,
    });
    const reward = calculateSecondarySponsorObjectiveReward({
      prestige: 5,
      categoryCode: "elite",
      targetRank: eliteRank,
    });

    expect(accessibleRank).toBe(10);
    expect(eliteRank).toBe(2);
    expect(reward).toBe(71_000);
    expect(reward).toBeLessThan(100_000);
  });

  it("borne strictement le placement du logo sur le maillot", () => {
    expect(
      normalizeSecondarySponsorLogoPlacement({
        xPercent: -100,
        yPercent: 200,
        scale: 9,
        rotationDegrees: -90,
      }),
    ).toEqual({
      xPercent: 15,
      yPercent: 78,
      scale: 1.8,
      rotationDegrees: -45,
    });
  });
});
