import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  RaceCalendarEdition,
  SeasonRaceCalendar,
} from "@/lib/game/race-calendar";

import { RaceLiveDirectory } from "./race-live-directory";

describe("RaceLiveDirectory", () => {
  it("affiche le jour courant, replie le passé et masque les courses futures", () => {
    const pastEdition = createEdition({
      id: "course-passee",
      name: "Classique passée",
      dayNumbers: [3],
    });
    const currentTour = createEdition({
      id: "tour-en-cours",
      name: "Tour en cours",
      dayNumbers: [2, 4, 5],
    });
    const futureEdition = createEdition({
      id: "course-future",
      name: "Course de demain",
      dayNumbers: [5],
    });
    const calendar = createCalendar({
      currentDayNumber: 4,
      editions: [pastEdition, currentTour, futureEdition],
    });

    const markup = renderToStaticMarkup(
      <RaceLiveDirectory
        calendar={calendar}
        nowIso="2026-07-29T20:00:00Z"
      />,
    );

    expect(markup).toContain('data-race-period="today"');
    expect(markup).toContain('data-race-period="past"');
    expect(markup).toContain("Courses passées");
    expect(markup).toContain("Classique passée");
    expect(markup).not.toContain("Course de demain");
    expect(markup).toContain('href="/jeu/resultats/tour-en-cours"');
    expect(markup).toContain("Résumé des étapes");
    expect(markup).toContain("1 étape à venir");
  });
});

function createCalendar({
  currentDayNumber,
  editions,
}: {
  currentDayNumber: number;
  editions: RaceCalendarEdition[];
}): SeasonRaceCalendar {
  return {
    seasonId: "season-1",
    seasonName: "Saison test",
    gameYear: 1,
    startsOn: "2026-07-26",
    endsOn: "2026-08-22",
    currentDayNumber,
    days: [],
    events: [],
    editions,
  };
}

function createEdition({
  id,
  name,
  dayNumbers,
}: {
  id: string;
  name: string;
  dayNumbers: number[];
}): RaceCalendarEdition {
  return {
    id,
    raceId: `race-${id}`,
    slug: id,
    name,
    shortName: name,
    countryName: "France",
    countryCode: "FR",
    categoryCode: "national",
    categoryName: "National",
    prestigeRank: 4,
    raceFormat: dayNumbers.length > 1 ? "stage_race" : "one_day",
    competitionType: "standard",
    registrationClosesAt: null,
    wildcardClosesAt: null,
    withdrawalClosesAt: null,
    registrationPolicy: "closed",
    minimumReputation: 0,
    minimumRosterSize: 5,
    maximumRosterSize: 7,
    engagedRiderCount: 5,
    engagedRiders: [],
    currentTeamRegistration: {
      status: "accepted",
      rosterCount: 5,
    },
    stages: dayNumbers.map((dayNumber, index) => ({
      id: `${id}-stage-${index + 1}`,
      dayNumber,
      stageNumber: index + 1,
      name: `Étape ${index + 1}`,
      stageType: "road",
      status: dayNumber < 4 ? "completed" : "planned",
      profileType: "mixed",
      distanceKm: 150,
      daySlot: "early",
      departureAt: null,
      segments: [],
    })),
  };
}
