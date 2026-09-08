import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InternationalYouthCenterMap } from "@/components/game/international-youth-center-map";
import { getInternationalCenterNetworkEffects } from "@/lib/game/infrastructure";

describe("InternationalYouthCenterMap", () => {
  it("explique les quatre effets du réseau sans présenter de plafond d’écoles", () => {
    const markup = renderToStaticMarkup(
      <InternationalYouthCenterMap
        countries={[
          {
            id: "country-fr",
            name: "France",
            code: "FR",
            latitude: 46.2,
            longitude: 2.2,
            totalQualityStars: 5,
            networkEffects: getInternationalCenterNetworkEffects(5),
            currentTeamLevel: 0,
            centers: [
              {
                id: "school-1",
                qualityLevel: 5,
                efficiencyBonusPercentage: 0,
                teamId: "team-1",
                teamName: "Équipe formatrice",
                directorName: "DS Test",
                directorIdentifier: "ds-test",
                completedAt: "2026-09-08T10:00:00.000Z",
                isCurrentTeam: false,
              },
            ],
          },
        ]}
        architects={[]}
        activeProjects={[]}
        directorLevel={50}
        balance={1_000_000}
        currency="EUR"
      />,
    );

    expect(markup).toContain("Chance +0,5 ★");
    expect(markup).toContain("Notes clés");
    expect(markup).toContain("Candidats / mission");
    expect(markup).toContain("Capacité spéciale");
    expect(markup).toContain("se cumulent sans limite");
    expect(markup).not.toContain("plafond mondial");
  });
});
