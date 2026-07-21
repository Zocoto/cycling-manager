import { describe, expect, it } from "vitest";

import {
  calculateNationRiderOverall,
  rankNationRiders,
  type NationRiderRatings,
} from "./nation-rider-ranking";

function ratings(value: number): NationRiderRatings {
  return {
    mountain: value,
    hills: value,
    flat: value,
    timeTrial: value,
    cobbles: value,
    sprint: value,
    acceleration: value,
    downhill: value,
    endurance: value,
    resistance: value,
    recovery: value,
    breakaway: value,
    prologue: value,
  };
}

describe("nation rider ranking", () => {
  it("calcule la moyenne générale sur les treize notes", () => {
    expect(
      calculateNationRiderOverall({
        ...ratings(60),
        mountain: 73,
      }),
    ).toBe(61);
  });

  it("conserve les cinq meilleurs, y compris un coureur sans équipe", () => {
    const ranked = rankNationRiders(
      [58, 72, 64, 81, 69, 76].map((overall, index) => ({
        id: `rider-${index}`,
        firstName: `Prénom ${index}`,
        lastName: `Nom ${index}`,
        teamId: index === 3 ? null : `team-${index}`,
        ratings: ratings(overall),
      })),
    );

    expect(ranked.map((rider) => rider.overall)).toEqual([81, 76, 72, 69, 64]);
    expect(ranked[0]?.teamId).toBeNull();
  });
});
