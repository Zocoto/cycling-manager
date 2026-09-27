import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RaceRecordsSummary } from "@/components/game/race-records-summary";

const records = [
  {
    type: "overall" as const,
    rank: 1,
    riderId: "11111111-1111-4111-8111-111111111111",
    riderName: "Lina Martin",
    victoryCount: 2,
    gameYears: [3, 1],
    latestGameYear: 3,
    latestTeamName: "Équipe Horizon",
  },
  {
    type: "stage" as const,
    rank: 1,
    riderId: "22222222-2222-4222-8222-222222222222",
    riderName: "Maya Dupont",
    victoryCount: 5,
    gameYears: [3, 2, 1],
    latestGameYear: 3,
    latestTeamName: "Vélo Club",
  },
];

describe("RaceRecordsSummary", () => {
  it("sépare les victoires finales et les victoires d’étapes d’un tour", () => {
    const markup = renderToStaticMarkup(
      <RaceRecordsSummary records={records} isStageRace />,
    );

    expect(markup).toContain("Victoires au classement général");
    expect(markup).toContain("Victoires d’étapes");
    expect(markup).toContain("Lina Martin");
    expect(markup).toContain("5</strong> victoires");
    expect(markup).toContain("S1 · S2 · S3");
  });

  it("ne duplique pas le classement d’étapes pour une classique", () => {
    const markup = renderToStaticMarkup(
      <RaceRecordsSummary records={records} isStageRace={false} />,
    );

    expect(markup).toContain("Victoires sur la classique");
    expect(markup).not.toContain("Victoires d’étapes");
  });
});
