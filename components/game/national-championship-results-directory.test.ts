import { describe, expect, it } from "vitest";

import { buildNationalChampionshipGroups } from "@/components/game/national-championship-results-directory";
import type {
  RaceCalendarEdition,
  RaceCompetitionType,
  SeasonRaceCalendar,
} from "@/lib/game/race-calendar";

function createEdition({
  id,
  countryCode,
  competitionType,
  dayNumber,
}: {
  id: string;
  countryCode: string;
  competitionType: RaceCompetitionType;
  dayNumber: number;
}): RaceCalendarEdition {
  return {
    id,
    status: "completed",
    raceId: `race-${id}`,
    slug: `cn-${countryCode.toLowerCase()}-${id}`,
    name: `CN ${countryCode}`,
    shortName: null,
    countryName: countryCode,
    countryCode,
    categoryCode: "national",
    categoryName: "National",
    prestigeRank: 1,
    raceFormat: "one_day",
    competitionType,
    registrationClosesAt: null,
    wildcardClosesAt: null,
    withdrawalClosesAt: null,
    registrationPolicy: "closed",
    minimumReputation: null,
    fieldLimit: 200,
    minimumRosterSize: 1,
    maximumRosterSize: 200,
    engagedRiderCount: 20,
    engagedRiders: [],
    currentTeamRegistration: null,
    stages: [
      {
        id: `stage-${id}`,
        dayNumber,
        stageNumber: 1,
        name: "Course nationale",
        stageType:
          competitionType === "national_time_trial"
            ? "individual_time_trial"
            : "road",
        status: "completed",
        profileType:
          competitionType === "national_time_trial" ? "time_trial" : "flat",
        distanceKm: 40,
        daySlot: "early",
        departureAt: "2026-08-08T12:00:00.000Z",
        segments: [],
      },
    ],
  };
}

describe("annuaire central des résultats CN", () => {
  it("crée une seule entrée par discipline et filtre les pays du DS", () => {
    const calendar: SeasonRaceCalendar = {
      seasonId: "season-1",
      seasonName: "Saison 1",
      gameYear: 1,
      startsOn: "2026-08-01",
      endsOn: "2026-08-30",
      currentDayNumber: 9,
      days: [],
      events: [],
      editions: [
        createEdition({
          id: "fr-tt",
          countryCode: "FR",
          competitionType: "national_time_trial",
          dayNumber: 8,
        }),
        createEdition({
          id: "be-tt",
          countryCode: "BE",
          competitionType: "national_time_trial",
          dayNumber: 8,
        }),
        createEdition({
          id: "fr-road",
          countryCode: "FR",
          competitionType: "national_road",
          dayNumber: 8,
        }),
        createEdition({
          id: "it-road",
          countryCode: "IT",
          competitionType: "national_road",
          dayNumber: 8,
        }),
      ],
    };

    const groups = buildNationalChampionshipGroups(
      calendar,
      new Set(["FR", "BE"]),
    );

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.competitionType)).toEqual([
      "national_time_trial",
      "national_road",
    ]);
    expect(groups[0]?.editions.map((edition) => edition.countryCode)).toEqual([
      "FR",
      "BE",
    ]);
    expect(groups[1]?.editions.map((edition) => edition.countryCode)).toEqual([
      "FR",
    ]);
    expect(groups.map((group) => group.dayNumber)).toEqual([8, 8]);
  });
});
