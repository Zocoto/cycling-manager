import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CyclogazetteArchiveNavigation } from "./cyclogazette-archive-navigation";

describe("CyclogazetteArchiveNavigation", () => {
  it("range les numéros par saison et conserve un accès à la dernière Une", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteArchiveNavigation
        currentEditionId="edition-older"
        latestEditionId="edition-latest"
        seasons={[
          {
            seasonId: "season-2",
            seasonName: "2",
            gameYear: 2,
            editions: [
              {
                id: "edition-latest",
                issueNumber: 33,
                seasonName: "2",
                dayNumber: 5,
                issueDate: "2026-08-02",
                subtitle: "Les sprinteurs prennent le pouvoir",
                publishedAt: "2026-08-02T18:00:00.000Z",
              },
              {
                id: "edition-older",
                issueNumber: 32,
                seasonName: "2",
                dayNumber: 4,
                issueDate: "2026-08-01",
                subtitle: "La montagne rend son verdict",
                publishedAt: "2026-08-01T18:00:00.000Z",
              },
            ],
          },
        ]}
      />,
    );

    expect(markup).toContain("Archives de la Gazette");
    expect(markup).toContain("Saison 2");
    expect(markup).toContain("Jour 4 · N° 32");
    expect(markup).toContain("edition=edition-older");
    expect(markup).toContain("Revenir à la dernière Une");
    expect(markup).toContain('aria-current="page"');
  });
});
