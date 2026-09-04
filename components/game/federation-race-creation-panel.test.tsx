import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FederationRaceCreationPanel } from "@/components/game/federation-race-creation-panel";
import type { FederationRaceCreationState } from "@/services/federation-race-creation";

const eligibleState: FederationRaceCreationState = {
  score: {
    nationRank: 1,
    rankingPoints: 40,
    completedObjectiveCount: 4,
    objectivePoints: 60,
    existingRaceCount: 4,
    calendarPenalty: 40,
    total: 60,
    threshold: 60,
    eligible: true,
  },
  officeLevel: 1,
  viewerIsPresident: true,
  canCreate: true,
  project: null,
};

describe("FederationRaceCreationPanel", () => {
  it("opens the complete homologation form only when every gate is met", () => {
    const markup = renderToStaticMarkup(
      <FederationRaceCreationPanel
        countryCode="BE"
        gameYear={4}
        state={eligibleState}
      />,
    );

    expect(markup).toContain("Homologuer la course");
    expect(markup).toContain('name="name"');
    expect(markup).toContain('name="shortName"');
    expect(markup).toContain('name="blueprint"');
    expect(markup).toContain("Tour par étapes");
    expect(markup).toContain("Continentale");
    expect(markup).toContain("Nationale");
    expect(markup).toContain("Régionale");
    expect(markup).not.toContain('value="elite"');
    expect(markup).not.toContain('value="world"');
    expect(markup).toContain("Ajouter un tronçon");
    expect(markup).toContain("Pente");
  });

  it("replaces the form with the public next-season summary after homologation", () => {
    const markup = renderToStaticMarkup(
      <FederationRaceCreationPanel
        countryCode="BE"
        gameYear={4}
        state={{
          ...eligibleState,
          canCreate: false,
          project: {
            id: "project-1",
            name: "Classique des Ardennes",
            shortName: "CDA",
            raceFormat: "one_day",
            categoryCode: "national",
            startDay: 12,
            startSlot: "early",
            activationGameYear: 5,
            status: "scheduled",
            submittedAt: "2026-09-04T10:00:00.000Z",
            stages: [
              {
                name: "Classique des Ardennes",
                stageType: "road",
                profileType: "hilly",
                segments: [
                  {
                    distanceKm: 165,
                    terrainType: "climb",
                    surfaceType: "asphalt",
                    averageGradientPct: 3.5,
                  },
                ],
              },
            ],
          },
        }}
      />,
    );

    expect(markup).toContain("Course homologuée · Saison 5");
    expect(markup).toContain("Classique des Ardennes");
    expect(markup).toContain("165 km");
    expect(markup).not.toContain("Homologuer la course");
  });
});
