import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  RaceCalendarEdition,
  SeasonRaceCalendar,
} from "@/lib/game/race-calendar";

import {
  DashboardEligibleRaces,
  getOpenEligibleDashboardRaces,
} from "./dashboard-eligible-races";

describe("dashboard eligible races", () => {
  it("ne garde que les inscriptions ouvertes et accessibles à l’équipe", () => {
    const calendar = createCalendar([
      createEdition("eligible", {
        minimumReputation: 100,
        minimumRosterSize: 6,
        startDay: 12,
      }),
      createEdition("reputation-locked", {
        minimumReputation: 200,
        minimumRosterSize: 6,
        startDay: 13,
      }),
      createEdition("roster-locked", {
        minimumReputation: 0,
        minimumRosterSize: 10,
        startDay: 14,
      }),
      createEdition("closed", {
        minimumReputation: 0,
        minimumRosterSize: 6,
        registrationPolicy: "closed",
        startDay: 15,
      }),
    ]);

    expect(
      getOpenEligibleDashboardRaces({
        calendar,
        reputationPoints: 125,
        riderCount: 8,
        now: new Date("2026-07-10T10:00:00.000Z"),
        limit: 4,
      }).map((race) => race.edition.id),
    ).toEqual(["eligible"]);
  });

  it("mène directement au panneau d’inscription de la course", () => {
    const markup = renderToStaticMarkup(
      <DashboardEligibleRaces
        calendar={createCalendar([
          createEdition("eligible", {
            minimumReputation: 100,
            minimumRosterSize: 6,
            startDay: 12,
          }),
        ])}
        reputationPoints={125}
        riderCount={8}
        now={new Date("2026-07-10T10:00:00.000Z")}
      />,
    );

    expect(markup).toContain("Course eligible");
    expect(markup).toContain("/jeu/courses/eligible#inscription");
    expect(markup).toContain("Inscriptions accessibles");
    expect(markup).not.toContain("data-race-preview-trigger");
  });
});

function createCalendar(
  editions: RaceCalendarEdition[],
): SeasonRaceCalendar {
  return {
    seasonId: "season-1",
    seasonName: "Saison 1",
    gameYear: 2026,
    startsOn: "2026-07-01",
    endsOn: "2026-07-31",
    currentDayNumber: 10,
    days: Array.from({ length: 31 }, (_, index) => ({
      id: `day-${index + 1}`,
      dayNumber: index + 1,
      calendarDate: `2026-07-${String(index + 1).padStart(2, "0")}`,
      label: null,
    })),
    events: [],
    editions,
  };
}

function createEdition(
  id: string,
  {
    minimumReputation,
    minimumRosterSize,
    registrationPolicy = "open",
    startDay,
  }: {
    minimumReputation: number;
    minimumRosterSize: number;
    registrationPolicy?: RaceCalendarEdition["registrationPolicy"];
    startDay: number;
  },
): RaceCalendarEdition {
  return {
    id,
    status: "planned",
    raceId: `race-${id}`,
    slug: id,
    name: `Course ${id}`,
    shortName: null,
    countryName: "France",
    countryCode: "FR",
    categoryCode: "continental",
    categoryName: "Continentale",
    prestigeRank: 10,
    raceFormat: "one_day",
    competitionType: "standard",
    registrationClosesAt: "2026-07-11T22:00:00.000Z",
    wildcardClosesAt: null,
    withdrawalClosesAt: null,
    registrationPolicy,
    minimumReputation,
    minimumRosterSize,
    maximumRosterSize: 8,
    engagedRiderCount: 0,
    engagedRiders: [],
    currentTeamRegistration: null,
    stages: [
      {
        id: `${id}-stage-1`,
        dayNumber: startDay,
        stageNumber: 1,
        name: "Étape 1",
        stageType: "road",
        status: "planned",
        profileType: "mixed",
        distanceKm: 180,
        daySlot: "early",
        departureAt: null,
        segments: [],
      },
    ],
  };
}
