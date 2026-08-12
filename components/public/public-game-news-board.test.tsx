import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PublicGameNewsBoard } from "./public-game-news-board";

describe("PublicGameNewsBoard", () => {
  it("présente uniquement les résultats et les publications de La Cyclogazette", () => {
    const markup = renderToStaticMarkup(
      <PublicGameNewsBoard
        snapshot={{
          items: [
            {
              id: "victory:1",
              kind: "victory",
              title: "Alice Martin s’impose",
              detail: "Son équipe remporte la course.",
              happenedAt: "2026-08-09T16:00:00.000Z",
            },
            {
              id: "gazette:42",
              kind: "gazette",
              title: "La Cyclogazette n°42 est publiée",
              detail: "Tous les résultats de la journée.",
              happenedAt: "2026-08-09T18:00:00.000Z",
            },
          ],
          totals: { directors: 37, victories: 12, gazettes: 42 },
          isLive: true,
        }}
      />,
    );

    expect(markup).toContain("Résultats en direct");
    expect(markup).toContain("La Cyclogazette n°42 est publiée");
    expect(markup).toContain("Directeurs actifs");
    expect(markup).toContain(">37<");
    expect(markup).toContain("Gazettes publiées");
    expect(markup).not.toContain("Nouveau DS");
    expect(markup).not.toContain("Bordures");
  });
});