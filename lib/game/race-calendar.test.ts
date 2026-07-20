import { describe, expect, it } from "vitest";

import {
  buildCalendarWeeks,
  getEffectiveSeasonDay,
  getRegistrationAvailability,
  isBeforeRegistrationDeadline,
  isRosterSelectionValid,
  type RaceCalendarEdition,
} from "./race-calendar";

describe("getEffectiveSeasonDay", () => {
  it("fait avancer le jour selon la date parisienne", () => {
    expect(
      getEffectiveSeasonDay({
        startsOn: "2026-07-17",
        persistedDayNumber: 1,
        parisDate: "2026-07-19",
      })
    ).toBe(3);
  });

  it("ne fait jamais reculer le jour persisté", () => {
    expect(
      getEffectiveSeasonDay({
        startsOn: "2026-07-17",
        persistedDayNumber: 8,
        parisDate: "2026-07-19",
      })
    ).toBe(8);
  });

  it("reste compris entre J1 et J28", () => {
    expect(
      getEffectiveSeasonDay({
        startsOn: "2026-07-17",
        persistedDayNumber: 1,
        parisDate: "2027-01-01",
      })
    ).toBe(28);
  });
});

describe("buildCalendarWeeks", () => {
  it("découpe une course traversant deux semaines", () => {
    const edition = createEdition(
      "tour-test",
      [6, 7, 8, 9, 10]
    );
    const weeks = buildCalendarWeeks([
      edition,
    ]);

    expect(weeks[0].segments[0]).toMatchObject({
      startDay: 6,
      endDay: 7,
      continuesAfterWeek: true,
    });
    expect(weeks[1].segments[0]).toMatchObject({
      startDay: 8,
      endDay: 10,
      startsBeforeWeek: true,
    });
  });

  it("place deux courses simultanées sur deux lignes", () => {
    const weeks = buildCalendarWeeks([
      createEdition("tour-a", [2, 3, 4]),
      createEdition("tour-b", [3, 4, 5]),
    ]);

    expect(weeks[0].laneCount).toBe(2);
    expect(
      weeks[0].segments.map(
        (segment) => segment.lane
      )
    ).toEqual([0, 1]);
  });
});

describe("getRegistrationAvailability", () => {
  it("ouvre une course nationale à réputation zéro", () => {
    expect(
      getRegistrationAvailability({
        policy: "open",
        closesAt: "2026-07-20T18:00:00Z",
        minimumReputation: 0,
        reputationPoints: 0,
        now: new Date("2026-07-19T10:00:00Z"),
      })
    ).toBe("open");
  });

  it("ferme les inscriptions à la date limite", () => {
    expect(
      getRegistrationAvailability({
        policy: "open",
        closesAt: "2026-07-19T10:00:00Z",
        minimumReputation: 0,
        reputationPoints: 0,
        now: new Date("2026-07-19T10:00:00Z"),
      })
    ).toBe("closed");
  });

  it("garde les catégories supérieures verrouillées tant que leurs critères ne sont pas fixés", () => {
    expect(
      getRegistrationAvailability({
        policy: "criteria_pending",
        closesAt: "2026-07-22T10:00:00Z",
        minimumReputation: null,
        reputationPoints: 100,
      })
    ).toBe("criteria_pending");
  });
});

describe("règles de composition et de retrait", () => {
  it.each([
    ["Elite minimum", 8, 8, 9, true],
    ["Elite sous le minimum", 7, 8, 9, false],
    ["Elite au-dessus du maximum", 10, 8, 9, false],
    ["National maximum", 6, 5, 6, true],
  ])(
    "%s",
    (_label, selectedCount, minimum, maximum, expected) => {
      expect(
        isRosterSelectionValid({
          selectedCount,
          minimum,
          maximum,
        })
      ).toBe(expected);
    }
  );

  it("autorise le retrait strictement avant H-12", () => {
    const cutoff = "2026-07-20T08:00:00Z";

    expect(
      isBeforeRegistrationDeadline(
        cutoff,
        new Date("2026-07-20T07:59:59Z")
      )
    ).toBe(true);
    expect(
      isBeforeRegistrationDeadline(
        cutoff,
        new Date("2026-07-20T08:00:00Z")
      )
    ).toBe(false);
  });
});

function createEdition(
  slug: string,
  dayNumbers: number[]
): RaceCalendarEdition {
  return {
    id: slug,
    raceId: `race-${slug}`,
    slug,
    name: slug,
    shortName: null,
    countryName: "France",
    countryCode: "FR",
    categoryCode: "elite",
    categoryName: "Elite",
    prestigeRank: 1,
    raceFormat: "stage_race",
    registrationClosesAt: null,
    withdrawalClosesAt: null,
    registrationPolicy: "criteria_pending",
    minimumReputation: null,
    minimumRosterSize: 8,
    maximumRosterSize: 9,
    engagedRiderCount: 0,
    engagedRiders: [],
    currentTeamRegistration: null,
    stages: dayNumbers.map(
      (dayNumber, index) => ({
        id: `${slug}-${dayNumber}`,
        dayNumber,
        stageNumber: index + 1,
        name: `Étape ${index + 1}`,
        stageType: "road",
        status: "planned",
        profileType: "mixed",
        distanceKm: 170,
        departureAt: null,
        segments: [],
      })
    ),
  };
}
