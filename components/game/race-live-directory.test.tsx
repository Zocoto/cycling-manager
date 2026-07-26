import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  RaceCalendarEdition,
  SeasonRaceCalendar,
} from "@/lib/game/race-calendar";

import { RaceLiveDirectory } from "./race-live-directory";

describe("RaceLiveDirectory", () => {
  it("hachure seulement les courses passées avant la journée courante", () => {
    const pastEdition = createEdition({
      id: "course-passee",
      dayNumbers: [3],
    });
    const currentTour = createEdition({
      id: "tour-en-cours",
      dayNumbers: [2, 3, 4],
    });
    const calendar = createCalendar({
      currentDayNumber: 4,
      editions: [pastEdition, currentTour],
    });

    const markup = renderToStaticMarkup(
      <RaceLiveDirectory
        calendar={calendar}
        nowIso="2026-07-29T20:00:00Z"
      />
    );

    expect(markup).toContain(
      'data-race-period="past"'
    );
    expect(markup).toContain(
      'data-race-period="current-or-upcoming"'
    );
    expect(markup).toContain(
      "Hachuré : course passée, replay disponible"
    );
    expect(markup).toContain(
      "repeating-linear-gradient"
    );
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
  dayNumbers,
}: {
  id: string;
  dayNumbers: number[];
}): RaceCalendarEdition {
  return {
    id,
    raceId: `race-${id}`,
    slug: id,
    name: id,
    shortName: id,
    countryName: "France",
    countryCode: "FR",
    categoryCode: "national",
    categoryName: "National",
    prestigeRank: 4,
    raceFormat:
      dayNumbers.length > 1
        ? "stage_race"
        : "one_day",
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
    stages: dayNumbers.map(
      (dayNumber, index) => ({
        id: `${id}-stage-${index + 1}`,
        dayNumber,
        stageNumber: index + 1,
        name: `Étape ${index + 1}`,
        stageType: "road",
        status:
          dayNumber < 4
            ? "completed"
            : "planned",
        profileType: "mixed",
        distanceKm: 150,
        daySlot: "early",
        departureAt: null,
        segments: [],
      })
    ),
  };
}
