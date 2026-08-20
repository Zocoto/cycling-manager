import { describe, expect, it } from "vitest";

import type { RaceCalendarEdition } from "@/lib/game/race-calendar";

import { getNationalChampionshipUnavailableReasons } from "./national-championship-availability";

describe("getNationalChampionshipUnavailableReasons", () => {
  it("signale une blessure qui couvre le départ du CN", () => {
    const target = createEdition({
      id: "cn-road-fr",
      name: "CN France",
      countryCode: "FR",
      competitionType: "national_road",
      departureAt: "2026-08-08T16:00:00.000Z",
    });

    expect(
      getNationalChampionshipUnavailableReasons({
        riderId: "rider-1",
        targetEdition: target,
        calendar: { editions: [target] },
        injuries: [
          {
            riderId: "rider-1",
            startedAt: "2026-08-07T12:00:00.000Z",
            expectedRecoveryAt: "2026-08-09T12:00:00.000Z",
          },
        ],
        raceEngagements: [],
      }),
    ).toEqual([{ kind: "injury" }]);
  });

  it("nomme chaque autre course qui occupe le même créneau", () => {
    const target = createEdition({
      id: "cn-road-fr",
      name: "CN France",
      countryCode: "FR",
      competitionType: "national_road",
      departureAt: "2026-08-08T16:00:00.000Z",
    });
    const conflictingRace = createEdition({
      id: "tour-conflict",
      name: "Tour déjà prévu",
      countryCode: "ES",
      competitionType: "standard",
      departureAt: "2026-08-08T16:00:00.000Z",
    });

    expect(
      getNationalChampionshipUnavailableReasons({
        riderId: "rider-1",
        targetEdition: target,
        calendar: { editions: [target, conflictingRace] },
        injuries: [],
        raceEngagements: [
          { riderId: "rider-1", raceEditionId: conflictingRace.id },
        ],
      }),
    ).toEqual([
      {
        kind: "race",
        raceEditionId: "tour-conflict",
        raceName: "Tour déjà prévu",
      },
    ]);
  });

  it("autorise une course à 14 h puis une autre à 18 h le même jour", () => {
    const target = createEdition({
      id: "classic-late",
      name: "Classique de 18 h",
      countryCode: "FR",
      competitionType: "standard",
      departureAt: "2026-08-08T16:00:00.000Z",
      daySlot: "late",
    });
    const earlyTour = createEdition({
      id: "tour-early",
      name: "Tour terminé à 14 h",
      countryCode: "ES",
      competitionType: "standard",
      departureAt: "2026-08-08T12:00:00.000Z",
      daySlot: "early",
    });

    expect(
      getNationalChampionshipUnavailableReasons({
        riderId: "rider-1",
        targetEdition: target,
        calendar: { editions: [target, earlyTour] },
        injuries: [],
        raceEngagements: [
          { riderId: "rider-1", raceEditionId: earlyTour.id },
        ],
      }),
    ).toEqual([]);
  });

  it("autorise le même coureur sur les deux disciplines de son CN", () => {
    const road = createEdition({
      id: "cn-road-fr",
      name: "CN France route",
      countryCode: "FR",
      competitionType: "national_road",
      departureAt: "2026-08-08T16:00:00.000Z",
      daySlot: "late",
    });
    const timeTrial = createEdition({
      id: "cn-tt-fr",
      name: "CN France CLM",
      countryCode: "FR",
      competitionType: "national_time_trial",
      departureAt: "2026-08-08T12:00:00.000Z",
      daySlot: "early",
    });

    expect(
      getNationalChampionshipUnavailableReasons({
        riderId: "rider-1",
        targetEdition: road,
        calendar: { editions: [road, timeTrial] },
        injuries: [],
        raceEngagements: [
          { riderId: "rider-1", raceEditionId: timeTrial.id },
        ],
      }),
    ).toEqual([]);
  });
});

function createEdition({
  id,
  name,
  countryCode,
  competitionType,
  departureAt,
  daySlot = "late",
}: {
  id: string;
  name: string;
  countryCode: string;
  competitionType: RaceCalendarEdition["competitionType"];
  departureAt: string;
  daySlot?: RaceCalendarEdition["stages"][number]["daySlot"];
}): RaceCalendarEdition {
  return {
    id,
    raceId: `${id}-race`,
    slug: id,
    name,
    shortName: null,
    countryName: countryCode,
    countryCode,
    categoryCode: "national",
    categoryName: "National",
    prestigeRank: 5,
    raceFormat: "one_day",
    competitionType,
    registrationClosesAt: null,
    wildcardClosesAt: null,
    withdrawalClosesAt: null,
    registrationPolicy: "open",
    minimumReputation: null,
    minimumRosterSize: 1,
    maximumRosterSize: 100,
    engagedRiderCount: 0,
    engagedRiders: [],
    currentTeamRegistration: null,
    stages: [
      {
        id: `${id}-stage`,
        dayNumber: 8,
        stageNumber: 1,
        name,
        stageType: "road",
        status: "planned",
        profileType: "flat",
        distanceKm: 100,
        daySlot,
        departureAt,
        segments: [],
      },
    ],
  } satisfies RaceCalendarEdition;
}
