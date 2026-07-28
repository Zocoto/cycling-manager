import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { UciRankings } from "@/services/uci-rankings";

import { DashboardMonitoringOverview } from "./dashboard-monitoring-overview";

describe("dashboard monitoring overview", () => {
  it("présente trois classements homogènes, limités à cinq entrées avant dépliage", () => {
    const markup = renderToStaticMarkup(
      <DashboardMonitoringOverview
        teamId="team-5"
        dashboardEvents={[]}
        rankings={createRankings()}
        pelotonNews={[
          {
            id: "victory:1",
            kind: "victory",
            title: "Victoire de référence",
            detail: "Le favori s’impose.",
            happenedAt: "2026-07-26T10:00:00.000Z",
            href: "/jeu/resultats/tour-des-alpes/3",
            significance: "major",
          },
          {
            id: "sponsor:1",
            kind: "movement",
            title: "Nouveau sponsor",
            detail: "Une équipe change de dimension.",
            happenedAt: "2026-07-25T10:00:00.000Z",
            significance: "major",
            teamColors: {
              primary: "#5B1A78",
              secondary: "#F4C542",
              accent: "#FFFFFF",
              background: "#5B1A78",
              text: "#FFFFFF",
            },
          },
          {
            id: "arrival:1",
            kind: "arrival",
            title: "Nouveau DS",
            detail: "Un manager rejoint le peloton.",
            happenedAt: "2026-07-24T10:00:00.000Z",
          },
          {
            id: "staff:1",
            kind: "staff",
            title: "Signature staff",
            detail: "Un entraîneur rejoint une équipe.",
            happenedAt: "2026-07-23T10:00:00.000Z",
          },
        ]}
      />,
    );

    expect(markup).toContain("À ne pas manquer");
    expect(markup).toContain("Temps forts");
    expect(markup).toContain(">Équipes<");
    expect(markup).toContain(">Coureurs<");
    expect(markup).toContain(">Pays<");
    expect(markup.match(/Afficher les rangs 6 à 10/g)).toHaveLength(3);
    expect(markup).toContain("Afficher 1 autre temps fort");
    expect(markup).toContain("/jeu/sponsoring");
    expect(markup).toContain('data-team-colors="team"');
    expect(markup).toContain("#5B1A78");
    expect(markup).toContain("#F4C542");
    expect(markup).toContain("/jeu/resultats/tour-des-alpes/3");
    expect(markup).toContain("votre équipe");
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
