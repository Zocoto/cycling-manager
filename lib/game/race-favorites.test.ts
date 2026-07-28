import { describe, expect, it } from "vitest";

import {
  buildRaceFavorites,
  getFrozenRaceFavoriteRiders,
} from "@/lib/game/race-favorites";
import type {
  RaceCalendarEdition,
  RaceCalendarStage,
  RaceProfileType,
} from "@/lib/game/race-calendar";
import type {
  RiderSimulationInput,
  RiderSimulationRatings,
} from "@/lib/game/race-simulation";

const BASE_RATINGS: RiderSimulationRatings = {
  flat: 60,
  mountain: 60,
  hills: 60,
  downhill: 60,
  cobbles: 60,
  timeTrial: 60,
  prologue: 60,
  sprint: 60,
  acceleration: 60,
  endurance: 60,
  resistance: 60,
  recovery: 60,
  breakaway: 60,
};

describe("buildRaceFavorites", () => {
  it("place un sprinteur devant un grimpeur sur une course plate", () => {
    const sprinter = createRider("sprinter", {
      sprint: 90,
      acceleration: 86,
      flat: 78,
    });
    const climber = createRider("climber", {
      mountain: 92,
      hills: 80,
      sprint: 45,
      acceleration: 52,
    });
    const edition = createEdition("one_day", [
      createStage("flat", [
        createSegment(1, "flat", 80),
        createSegment(2, "flat", 80),
      ]),
    ], [climber, sprinter]);

    expect(buildRaceFavorites({ edition })[0].rider.id).toBe("sprinter");
  });

  it("place un grimpeur devant un sprinteur lors d'une arrivée en montagne", () => {
    const sprinter = createRider("sprinter", {
      sprint: 92,
      acceleration: 88,
      mountain: 50,
    });
    const climber = createRider("climber", {
      mountain: 91,
      hills: 82,
      endurance: 84,
      resistance: 82,
    });
    const edition = createEdition("one_day", [
      createStage("mountain", [
        createSegment(1, "flat", 70),
        createSegment(2, "climb", 18, 7.5),
      ]),
    ], [sprinter, climber]);

    expect(buildRaceFavorites({ edition })[0].rider.id).toBe("climber");
  });

  it("évalue une course par étapes pour le général et limite la liste à vingt", () => {
    const allRounder = createRider("all-rounder", {
      mountain: 83,
      hills: 81,
      timeTrial: 82,
      endurance: 84,
      resistance: 82,
      recovery: 86,
    });
    const pureSprinter = createRider("pure-sprinter", {
      flat: 84,
      sprint: 95,
      acceleration: 92,
      mountain: 45,
      timeTrial: 52,
      recovery: 58,
    });
    const field = [
      pureSprinter,
      ...Array.from({ length: 23 }, (_, index) =>
        createRider(`rider-${index + 1}`, {
          mountain: 62 + index,
          hills: 61 + index,
        }),
      ),
      allRounder,
    ];
    const edition = createEdition(
      "stage_race",
      [
        createStage("flat", [createSegment(1, "flat", 150)], 1),
        createStage(
          "mountain",
          [
            createSegment(1, "flat", 90),
            createSegment(2, "climb", 24, 8),
          ],
          2,
        ),
        createStage(
          "time_trial",
          [createSegment(1, "flat", 32)],
          3,
          "individual_time_trial",
        ),
      ],
      field,
    );

    const favorites = buildRaceFavorites({ edition });

    expect(favorites).toHaveLength(20);
    expect(favorites[0].rider.id).toBe("all-rounder");
    expect(favorites.slice(0, 3).every((favorite) => favorite.stars === 3)).toBe(true);
    expect(favorites.slice(3, 10).every((favorite) => favorite.stars === 2)).toBe(true);
    expect(favorites.slice(10).every((favorite) => favorite.stars === 1)).toBe(true);
  });

  it("recalcule immédiatement le pronostic quand un favori rejoint la startlist", () => {
    const initialRiders = [
      createRider("rider-a", { sprint: 68 }),
      createRider("rider-b", { sprint: 70 }),
    ];
    const superstar = createRider("superstar", {
      sprint: 96,
      acceleration: 94,
      flat: 90,
    });
    const edition = createEdition(
      "one_day",
      [createStage("sprint", [createSegment(1, "flat", 180)])],
      initialRiders,
    );

    expect(buildRaceFavorites({ edition })[0].rider.id).toBe("rider-b");
    expect(
      buildRaceFavorites({
        edition,
        riders: [...initialRiders, superstar],
      })[0].rider.id,
    ).toBe("superstar");
  });
});

describe("getFrozenRaceFavoriteRiders", () => {
  it("conserve la startlist de la première étape d'un tour", () => {
    const original = createRider("original");
    const lateEditionRider = createRider("late-edition");
    const stageOne = createStage("flat", [createSegment(1, "flat", 120)], 1);
    const stageTwo = createStage("hilly", [createSegment(1, "climb", 120, 4)], 2);
    const edition = createEdition(
      "stage_race",
      [stageTwo, stageOne],
      [lateEditionRider],
    );

    const riders = getFrozenRaceFavoriteRiders(edition, [
      {
        stageId: stageTwo.id,
        input: { riders: [lateEditionRider] },
      },
      {
        stageId: stageOne.id,
        input: { riders: [original] },
      },
    ]);

    expect(riders.map((rider) => rider.id)).toEqual(["original"]);
  });

  it("utilise la startlist de l’étape demandée et retire les indisponibles", () => {
    const original = createRider("original");
    const climber = createRider("climber", { mountain: 90 });
    const withdrawn = createRider("withdrawn", { mountain: 95 });
    const stageOne = createStage(
      "flat",
      [createSegment(1, "flat", 120)],
      1,
    );
    const stageSix = createStage(
      "mountain",
      [createSegment(1, "climb", 152, 7)],
      6,
    );
    const edition = createEdition(
      "stage_race",
      [stageOne, stageSix],
      [original, climber, withdrawn],
    );

    const riders = getFrozenRaceFavoriteRiders(
      edition,
      [
        {
          stageId: stageOne.id,
          input: { riders: [original, climber, withdrawn] },
        },
        {
          stageId: stageSix.id,
          input: {
            riders: [original, climber, withdrawn],
            unavailableRiderIds: [withdrawn.id],
          },
        },
      ],
      stageSix.id,
    );

    expect(riders.map((rider) => rider.id)).toEqual([
      "original",
      "climber",
    ]);
  });
});

function createEdition(
  raceFormat: RaceCalendarEdition["raceFormat"],
  stages: RaceCalendarStage[],
  engagedRiders: RiderSimulationInput[],
): RaceCalendarEdition {
  return {
    id: "edition-1",
    raceId: "race-1",
    slug: "course-test",
    name: "Course test",
    shortName: null,
    countryName: "France",
    countryCode: "FR",
    categoryCode: "national",
    categoryName: "Nationale",
    prestigeRank: 1,
    raceFormat,
    competitionType: "standard",
    registrationClosesAt: null,
    wildcardClosesAt: null,
    withdrawalClosesAt: null,
    registrationPolicy: "open",
    minimumReputation: null,
    minimumRosterSize: 1,
    maximumRosterSize: 8,
    engagedRiderCount: engagedRiders.length,
    engagedRiders,
    currentTeamRegistration: null,
    stages,
  };
}

function createStage(
  profileType: RaceProfileType,
  segments: RaceCalendarStage["segments"],
  stageNumber = 1,
  stageType: RaceCalendarStage["stageType"] = "road",
): RaceCalendarStage {
  return {
    id: `stage-${stageNumber}`,
    dayNumber: stageNumber,
    stageNumber,
    name: `Étape ${stageNumber}`,
    stageType,
    status: "planned",
    profileType,
    distanceKm: segments.reduce(
      (total, segment) => total + segment.distanceKm,
      0,
    ),
    daySlot: "early",
    departureAt: null,
    segments,
  };
}

function createSegment(
  segmentNumber: number,
  terrain: RaceCalendarStage["segments"][number]["terrain"],
  distanceKm: number,
  averageGradientPct = 0,
): RaceCalendarStage["segments"][number] {
  return {
    segmentNumber,
    terrain,
    distanceKm,
    averageGradientPct,
    surface: "asphalt",
    prime: null,
  };
}

function createRider(
  id: string,
  ratings: Partial<RiderSimulationRatings> = {},
): RiderSimulationInput {
  return {
    id,
    name: id,
    teamId: `team-${id}`,
    teamName: `Équipe ${id}`,
    teamPrimaryColor: "#176951",
    teamSecondaryColor: "#FFFDF4",
    avatarProfileKey: null,
    avatarSeed: id,
    age: 27,
    form: 75,
    careerRaceDays: 80,
    role: "leader",
    ratings: {
      ...BASE_RATINGS,
      ...ratings,
    },
  };
}
