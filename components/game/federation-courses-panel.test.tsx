import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FederationCoursesPanel } from "@/components/game/federation-courses-panel";
import type { FederationCoursesState } from "@/services/federation-courses";

const state: FederationCoursesState = {
  renown: {
    score: 418,
    label: "Nation reconnue",
    sourceThroughGameYear: 3,
    breakdown: { uciHistory: 260, teamLegacy: 90, riderLegacy: 62, hostingLegacy: 6 },
  },
  officeLevel: 1,
  portfolio: [
    {
      id: "race-1",
      slug: "tour-du-pays",
      name: "Tour du pays",
      shortName: "TDP",
      format: "stage_race",
      competitionType: "standard",
      editionId: "edition-1",
      editionStatus: "registration_open",
      categoryCode: "continental",
      categoryName: "Continental",
      prestigeRank: 3,
      acceptedTeamCount: 18,
      pendingTeamCount: 2,
      rejectedTeamCount: 1,
      withdrawnTeamCount: 1,
      activeRiderCount: 108,
      fieldLimit: 30,
      teamParticipationPercentage: 60,
      riderFillPercentage: 86,
      completedStageCount: 0,
      totalStageCount: 4,
      returnStatus: "projected",
      moneyGain: 25_000,
      prestigeGain: 12,
      gainKind: "mixed",
      profiles: [
        { type: "flat", count: 2 },
        { type: "mountain", count: 2 },
      ],
      pastWinners: [
        {
          gameYear: 2,
          riderName: "Jeanne Peloton",
          teamName: "Équipe formatrice",
        },
      ],
    },
  ],
  hosting: {
    targetGameYear: 4,
    applicationCloseDay: 20,
    decisionDay: 21,
    viewerIsPresident: true,
    balance: 4_000_000,
    reservedAmount: 0,
    candidacies: [],
    opportunities: [
      {
        eventType: "nations_cup_junior",
        riderCategory: "junior",
        eventKey: "nations_cup_junior",
        label: "Nations Cup juniors",
        shortLabel: "NC Junior",
        hostingCost: 550_000,
        prestigeGain: 12,
        projectedAttendance: 72_000,
        projectedGrossRevenue: 1_008_000,
        projectedNetReturn: 58_000,
        candidacy: null,
        selectedHostName: null,
        canApply: true,
        unavailableReason: null,
      },
    ],
  },
};

describe("FederationCoursesPanel", () => {
  it("shows the portfolio, public hosting economics and historical renown", () => {
    const markup = renderToStaticMarkup(
      <FederationCoursesPanel
        countryCode="FR"
        gameYear={3}
        state={state}
        raceCreationState={null}
      />,
    );

    expect(markup).toContain("Courses du pays");
    expect(markup).toContain("Tour du pays");
    expect(markup).toContain("Participation équipes");
    expect(markup).toContain("Montagne");
    expect(markup).toContain("Derniers vainqueurs");
    expect(markup).toContain("Jeanne Peloton");
    expect(markup).toContain("60 %");
    expect(markup).toContain("Nation reconnue");
    expect(markup).toContain("Classements UCI · 10 saisons");
    expect(markup).toContain("Nations Cup juniors");
    expect(markup).toContain("Six candidatures");
    expect(markup).toContain("Coût si retenu");
    expect(markup).toContain("Déposer la candidature");
    expect(markup).toContain('name="eventType"');
  });
});
