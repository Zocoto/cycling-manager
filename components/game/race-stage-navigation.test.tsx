import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RaceCalendarEdition } from "@/lib/game/race-calendar";

import { RaceStageNavigation } from "./race-stage-navigation";

describe("RaceStageNavigation", () => {
  it("permet de revenir en arrière et garde la prochaine étape future désactivée", () => {
    const edition = createTour();

    const markup = renderToStaticMarkup(
      <RaceStageNavigation
        edition={edition}
        currentStageNumber={2}
        currentDayNumber={4}
      />,
    );

    expect(markup).toContain('href="/jeu/resultats/tour-test/1"');
    expect(markup).toContain('href="/jeu/resultats/tour-test"');
    expect(markup).not.toContain('href="/jeu/resultats/tour-test/3"');
    expect(markup).toContain("Disponible à J5");
  });

  it("active l’étape suivante dès que son jour est atteint", () => {
    const markup = renderToStaticMarkup(
      <RaceStageNavigation
        edition={createTour()}
        currentStageNumber={2}
        currentDayNumber={5}
      />,
    );

    expect(markup).toContain('href="/jeu/resultats/tour-test/3"');
  });
});

function createTour(): RaceCalendarEdition {
  return {
    id: "tour-test",
    raceId: "race-tour-test",
    slug: "tour-test",
    name: "Tour test",
    shortName: "Tour test",
    countryName: "France",
    countryCode: "FR",
    categoryCode: "national",
    categoryName: "National",
    prestigeRank: 4,
    raceFormat: "stage_race",
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
    stages: [3, 4, 5].map((dayNumber, index) => ({
      id: `stage-${index + 1}`,
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
