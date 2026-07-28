import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  RaceCalendarEdition,
  RaceCalendarStage,
} from "@/lib/game/race-calendar";
import type { RiderSimulationInput } from "@/lib/game/race-simulation";

import { RaceFavoritesPanel } from "./race-favorites-panel";

describe("RaceFavoritesPanel", () => {
  it("affiche le podium puis les groupes deux et une étoile", () => {
    const riders = Array.from({ length: 12 }, (_, index) =>
      createRider(index + 1),
    );
    const edition = createEdition(riders);
    const markup = renderToStaticMarkup(
      <RaceFavoritesPanel
        edition={edition}
        riders={riders}
        frozen
      />,
    );

    expect(markup).toContain("Favoris de la course");
    expect(markup).toContain("Startlist officielle");
    expect(markup).toContain('data-favorite-rank="1"');
    expect(markup).toContain('data-favorite-rank="10"');
    expect(markup).toContain('data-favorite-rank="11"');
    expect(markup).toContain('data-favorite-stars="2"');
    expect(markup).toContain('data-favorite-stars="1"');
    expect(markup.match(/data-favorite-stars="3"/g)).toHaveLength(3);
    expect(
      markup.match(/data-rider-preview-trigger/g),
    ).toHaveLength(riders.length);
    expect(markup).toContain('aria-haspopup="dialog"');
  });

  it("affiche le maillot du sponsor plutôt que de reconstruire le maillot amateur", () => {
    const sponsoredRider: RiderSimulationInput = {
      ...createRider(1),
      teamPrimaryColor: "#112233",
      teamSecondaryColor: "#F4C542",
      teamJersey: {
        primaryColor: "#112233",
        secondaryColor: "#F4C542",
        accentColor: "#FFFFFF",
        pattern: "diagonal",
        status: "sponsored",
        imagePath: "/images/sponsors/test/jersey-modern.png",
      },
    };
    const markup = renderToStaticMarkup(
      <RaceFavoritesPanel
        edition={createEdition([sponsoredRider])}
        riders={[sponsoredRider]}
      />,
    );

    expect(markup).toContain("/images/sponsors/test/jersey-modern.png");
    expect(markup).toContain("#112233");
    expect(markup).toContain("#F4C542");
  });

  it("explique que le pronostic attend les premiers engagés", () => {
    const markup = renderToStaticMarkup(
      <RaceFavoritesPanel
        edition={createEdition([])}
        riders={[]}
      />,
    );

    expect(markup).toContain(
      "Les favoris apparaîtront dès que des coureurs seront engagés.",
    );
  });
});

function createEdition(
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
    raceFormat: "one_day",
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
    stages: [createStage()],
  };
}

function createStage(): RaceCalendarStage {
  return {
    id: "stage-1",
    dayNumber: 1,
    stageNumber: 1,
    name: "Course test",
    stageType: "road",
    status: "planned",
    profileType: "flat",
    distanceKm: 150,
    daySlot: "early",
    departureAt: null,
    segments: [
      {
        segmentNumber: 1,
        terrain: "flat",
        distanceKm: 150,
        averageGradientPct: 0,
        surface: "asphalt",
        prime: null,
      },
    ],
  };
}

function createRider(index: number): RiderSimulationInput {
  const rating = 90 - index;
  return {
    id: `rider-${index}`,
    name: `Coureur ${index}`,
    teamId: `team-${index}`,
    teamName: `Équipe ${index}`,
    teamPrimaryColor: "#176951",
    teamSecondaryColor: "#FFFDF4",
    avatarProfileKey: null,
    avatarSeed: index,
    age: 25,
    form: 75,
    role: "leader",
    ratings: {
      flat: rating,
      mountain: 60,
      hills: 60,
      downhill: 60,
      cobbles: 60,
      timeTrial: 60,
      prologue: 60,
      sprint: rating,
      acceleration: rating,
      endurance: 70,
      resistance: 70,
      recovery: 70,
      breakaway: 60,
    },
  };
}
