import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SportingDirectorReputation } from "./sporting-director-reputation";

describe("SportingDirectorReputation", () => {
  it("rend la valeur compacte consultable avec un libell\u00e9 accessible", () => {
    const markup = renderToStaticMarkup(
      <SportingDirectorReputation
        reputationPoints={3.5}
        compact
        breakdown={{
          items: [
            {
              key: "race-results",
              label: "R\u00e9sultats en course",
              points: 3.5,
            },
          ],
          recentGains: [],
          totalGains: 3.5,
          totalLosses: 0,
          currentPoints: 3.5,
          committedPoints: 0,
          availablePoints: 3.5,
          peakPoints: 3.5,
          tierLabel: "Amateur",
          nextTierLabel: "Prometteur",
          nextTierMinimum: 30,
        }}
      />,
    );

    expect(markup).toContain("3,5 points");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("Consulter le d\u00e9tail");
  });

  it("affiche les valeurs au-delà de 1 000 points", () => {
    const markup = renderToStaticMarkup(
      <SportingDirectorReputation reputationPoints={1_250} />,
    );

    expect(markup).toContain("1\u202f250 points");
    expect(markup).toContain("Institution");
    expect(markup).toContain("n’est plus plafonnée");
  });
});
