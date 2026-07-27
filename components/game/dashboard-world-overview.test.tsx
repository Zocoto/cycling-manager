import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  RaceCalendarEdition,
  SeasonRaceCalendar,
} from "@/lib/game/race-calendar";
import type { UciRankings } from "@/services/uci-rankings";

import {
  DashboardWorldOverview,
  getTeamRankingWindow,
  getUpcomingRaces,
} from "./dashboard-world-overview";

describe("dashboard world overview", () => {
  it("centre le voisinage UCI sur l’équipe du joueur", () => {
    const teams = Array.from({ length: 14 }, (_, index) => ({
      rank: index + 1,
      teamId: `team-${index + 1}`,
      teamName: `Équipe ${index + 1}`,
      directorName: null,
      directorUsername: null,
      points: 1_500 - index * 50,
      division: "world" as const,
      projectedDivision: "world" as const,
    }));

    expect(
      getTeamRankingWindow(teams, 6, 4).map((entry) => entry.rank),
    ).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("ne conserve que les courses encore à venir, toutes catégories confondues", () => {
    const calendar = createCalendar([
      createEdition("past", [2], "completed", "elite"),
      createEdition("today", [10], "in_progress", "world"),
      createEdition("future", [11, 12], "planned", "continental"),
    ]);

    expect(
      getUpcomingRaces(calendar, 5).map((race) => race.edition.id),
    ).toEqual(["today", "future"]);
  });

  it("rend les informations globales et les listes repliables", () => {
    const rankings = createRankings();
    const markup = renderToStaticMarkup(
      <DashboardWorldOverview
        teamId="team-5"
        dashboardEvents={[]}
        rankings={rankings}
        calendar={createCalendar([
          createEdition("future", [11], "planned", "continental"),
        ])}
        pelotonNews={[
          {
            id: "victory:1",
            kind: "victory",
            title: "Une victoire de référence",
            detail: "Le leader s’impose au sommet.",
            happenedAt: "2026-07-26T10:00:00.000Z",
            significance: "major",
          },
        ]}
      />,
    );

    expect(markup).toContain("Le cyclisme en un coup d’œil");
    expect(markup).toContain("Votre équipe est 5e");
    expect(markup).toContain("Une victoire de référence");
    expect(markup).toContain("Top 10 coureurs");
    expect(markup).toContain("Top 10 nations");
    expect(markup).toContain("<details open=\"\"");
    expect(markup).toContain("/jeu/equipes/team-5");
    expect(markup).toContain("/jeu/courses/future");
  });
});

function createRankings(): UciRankings {
  return {
    seasonId: "season-1",
    seasonName: "Saison 1",
    teams: Array.from({ length: 10 }, (_, index) => ({
      rank: index + 1,
      teamId: `team-${index + 1}`,
      teamName: `Équipe ${index + 1}`,
      directorName: null,
      directorUsername: null,
      points: 1_000 - index * 50,
      division: "world",
      projectedDivision: "world",
    })),
    riders: Array.from({ length: 10 }, (_, index) => ({
      rank: index + 1,
      riderId: `rider-${index + 1}`,
      riderName: `Coureur ${index + 1}`,
      teamId: `team-${index + 1}`,
      teamName: `Équipe ${index + 1}`,
      countryCode: "FR",
      countryName: "France",
      points: 500 - index * 20,
    })),
    nations: Array.from({ length: 10 }, (_, index) => ({
      rank: index + 1,
      countryCode: index === 0 ? "FR" : `C${index}`,
      countryName: `Nation ${index + 1}`,
      points: 2_000 - index * 100,
      riderCount: 10,
    })),
  };
}

function createCalendar(
  editions: RaceCalendarEdition[],
): SeasonRaceCalendar {
  return {
    seasonId: "season-1",
    seasonName: "Saison 1",
    gameYear: 2026,
    startsOn: "2026-07-01",
    endsOn: "2026-07-28",
    currentDayNumber: 10,
    days: Array.from({ length: 28 }, (_, index) => ({
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
  stageDays: number[],
  status: RaceCalendarEdition["status"],
  categoryCode: RaceCalendarEdition["categoryCode"],
): RaceCalendarEdition {
  return {
    id,
    status,
    raceId: `race-${id}`,
    slug: id,
    name: `Course ${id}`,
    shortName: null,
    countryName: "France",
    countryCode: "FR",
    categoryCode,
    categoryName: categoryCode,
    prestigeRank: 10,
    raceFormat: stageDays.length > 1 ? "stage_race" : "one_day",
    competitionType: "standard",
    registrationClosesAt: null,
    wildcardClosesAt: null,
    withdrawalClosesAt: null,
    registrationPolicy: "open",
    minimumReputation: null,
    minimumRosterSize: 5,
    maximumRosterSize: 7,
    engagedRiderCount: 0,
    engagedRiders: [],
    currentTeamRegistration: null,
    stages: stageDays.map((dayNumber, index) => ({
      id: `${id}-stage-${index + 1}`,
      dayNumber,
      stageNumber: index + 1,
      name: `Étape ${index + 1}`,
      stageType: "road",
      status:
        status === "completed"
          ? "completed"
          : status === "in_progress"
            ? "in_progress"
            : "planned",
      profileType: "mixed",
      distanceKm: 180,
      daySlot: "early",
      departureAt: null,
      segments: [],
    })),
  };
}
