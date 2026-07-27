import { describe, expect, it } from "vitest";

import {
  createRadarPoints,
  getRiderRatingImportance,
  getRiderSportingProfile,
  isSeasonPartOfRiderHistory,
  RIDER_PRIMARY_RATING_KEYS,
  RIDER_RATING_AXES,
  RIDER_SECONDARY_RATING_KEYS,
  resolvePublicTeamName,
  type RiderRatings,
  serializeRadarPoints,
} from "./rider-profile";

describe("rider career history", () => {
  it("only includes seasons that have actually started", () => {
    expect(isSeasonPartOfRiderHistory("active")).toBe(true);
    expect(isSeasonPartOfRiderHistory("completed")).toBe(true);
    expect(isSeasonPartOfRiderHistory("planned")).toBe(false);
    expect(isSeasonPartOfRiderHistory("cancelled")).toBe(false);
  });

  it("keeps the historical season name when it is public", () => {
    expect(
      resolvePublicTeamName({
        seasonDisplayName: "Union Cycliste des Coquinous",
        amateurName: "Nouveau nom",
        internalName: "initial_team_1234abcd",
      })
    ).toBe("Union Cycliste des Coquinous");
  });

  it("never exposes a generated technical team identifier", () => {
    expect(
      resolvePublicTeamName({
        seasonDisplayName: "initial_team_3161715aad6a4335b82045fc1969a849",
        amateurName: "Union Cycliste des Coquinous",
        internalName: "initial_team_3161715aad6a4335b82045fc1969a849",
      })
    ).toBe("Union Cycliste des Coquinous");
  });
});

describe("rider profile radar", () => {
  it("separates primary ratings from secondary ratings", () => {
    expect(RIDER_PRIMARY_RATING_KEYS).toEqual([
      "mountain",
      "hills",
      "flat",
      "timeTrial",
      "cobbles",
      "sprint",
    ]);
    expect(RIDER_SECONDARY_RATING_KEYS).toHaveLength(7);
    expect(getRiderRatingImportance("mountain")).toBe("primary");
    expect(getRiderRatingImportance("recovery")).toBe("secondary");
    expect(
      RIDER_RATING_AXES.every(
        (axis) => axis.importance === getRiderRatingImportance(axis.key),
      ),
    ).toBe(true);
  });

  it("keeps coherent rider ratings next to each other", () => {
    expect(RIDER_RATING_AXES.slice(0, 3).map((axis) => axis.shortLabel)).toEqual([
      "MON",
      "VAL",
      "REC",
    ]);
  });

  it("clamps values and starts at the top of the radar", () => {
    const points = createRadarPoints({
      values: [120, 50, -10],
      center: 100,
      radius: 80,
    });

    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ x: 100, y: 20 });
    expect(points[2]).toEqual({ x: 100, y: 100 });
  });

  it("serializes stable SVG polygon coordinates", () => {
    expect(
      serializeRadarPoints([
        { x: 10.123, y: 20.126 },
        { x: 30, y: 40 },
      ])
    ).toBe("10.12,20.13 30,40");
  });

  it.each([
    [{ mountain: 70 }, "Grimpeur"],
    [{ hills: 70 }, "Puncheur"],
    [{ cobbles: 70 }, "Coureur de pavés"],
    [{ sprint: 70 }, "Sprinteur"],
    [{ breakaway: 70 }, "Baroudeur"],
  ] as const)(
    "uses only the dominant primary rating for %s",
    (overrides, expectedProfile) => {
      expect(getRiderSportingProfile(createRatings(overrides))).toBe(
        expectedProfile
      );
    }
  );

  it("requires both mountain and time trial ratings for a tour rider", () => {
    expect(
      getRiderSportingProfile(
        createRatings({
          mountain: 69,
          timeTrial: 67,
        })
      )
    ).toBe("Coureur de tour");

    expect(
      getRiderSportingProfile(
        createRatings({
          mountain: 69,
          timeTrial: 61,
        })
      )
    ).toBe("Grimpeur");
  });

  it("creates a two-profile hybrid within a four-point gap", () => {
    expect(
      getRiderSportingProfile(
        createRatings({
          mountain: 69,
          hills: 65,
        })
      )
    ).toBe("Grimpeur / Puncheur");

    expect(
      getRiderSportingProfile(
        createRatings({
          mountain: 70,
          hills: 65,
        })
      )
    ).toBe("Grimpeur");
  });

  it("keeps at most the two most representative specialties", () => {
    expect(
      getRiderSportingProfile(
        createRatings({
          mountain: 69,
          hills: 68,
          sprint: 67,
        })
      )
    ).toBe("Grimpeur / Puncheur");
  });

  it("labels a rider without a strong primary rating as balanced", () => {
    expect(
      getRiderSportingProfile(
        createRatings({
          mountain: 61,
          hills: 60,
          timeTrial: 61,
          cobbles: 59,
          sprint: 60,
          breakaway: 61,
        })
      )
    ).toBe("Coureur équilibré");
  });

  it("matches the representative cases from the roster", () => {
    expect(
      getRiderSportingProfile(
        createRatings({
          mountain: 70,
          breakaway: 65,
        })
      )
    ).toBe("Grimpeur");

    expect(
      getRiderSportingProfile(
        createRatings({
          mountain: 64,
          cobbles: 70,
          sprint: 64,
        })
      )
    ).toBe("Coureur de pavés");
  });
});

function createRatings(overrides: Partial<RiderRatings>): RiderRatings {
  return {
    mountain: 50,
    hills: 50,
    recovery: 55,
    endurance: 55,
    resistance: 55,
    breakaway: 50,
    downhill: 55,
    acceleration: 55,
    sprint: 50,
    flat: 55,
    cobbles: 50,
    prologue: 50,
    timeTrial: 50,
    ...overrides,
  };
}
