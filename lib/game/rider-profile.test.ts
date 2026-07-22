import { describe, expect, it } from "vitest";

import {
  createRadarPoints,
  getRiderSportingProfile,
  isSeasonPartOfRiderHistory,
  RIDER_RATING_AXES,
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

  it("keeps every qualifying specialty when the current ratings evolve", () => {
    const breakawayRider = createRatings({
      breakaway: 66,
      endurance: 62,
      cobbles: 54,
      resistance: 59,
    });

    expect(getRiderSportingProfile(breakawayRider)).toBe("Baroudeur");
    expect(
      getRiderSportingProfile({
        ...breakawayRider,
        cobbles: 68,
        resistance: 64,
      })
    ).toBe("Spécialiste des pavés / Baroudeur");
  });

  it("shows two or three hybrid specialties ordered by their main rating", () => {
    const hybridRider = createRatings({
      mountain: 69,
      hills: 67,
      acceleration: 65,
      sprint: 66,
    });

    expect(getRiderSportingProfile(hybridRider)).toBe(
      "Grimpeur / Puncheur / Sprinteur"
    );
    expect(
      getRiderSportingProfile({
        ...hybridRider,
        mountain: 60,
      })
    ).toBe("Puncheur / Sprinteur");
  });

  it("uses the complete-rider label beyond three qualifying specialties", () => {
    expect(
      getRiderSportingProfile(
        createRatings({
          mountain: 69,
          hills: 67,
          acceleration: 65,
          sprint: 66,
          cobbles: 68,
          resistance: 62,
        })
      )
    ).toBe("Coureur complet");
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
