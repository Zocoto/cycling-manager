import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CyclogazetteGalaReplays } from "./cyclogazette-gala-replays";

describe("CyclogazetteGalaReplays", () => {
  it("publie chaque film avec son vrai vainqueur sans charger YouTube", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteGalaReplays
        sourceGameYear={3}
        replays={[
          {
            id: "replay-1",
            groupNumber: 1,
            youtubeVideoId: "Abcdef123_-",
            winnerRiderId: "rider-1",
            winnerTeamId: "team-1",
            winnerRiderName: "Dijilly Sidibé",
            winnerTeamName: "Cyclo Club",
          },
          {
            id: "replay-2",
            groupNumber: 2,
            youtubeVideoId: "Zyxwvu987_-",
            winnerRiderId: "rider-2",
            winnerTeamId: "team-2",
            winnerRiderName: "Anaïs Martin",
            winnerTeamName: "Vélo Club",
          },
        ]}
      />,
    );

    expect(markup).toContain('data-gazette-gala-replays="true"');
    expect(markup).toContain("Les vainqueurs en images");
    expect(markup).toContain("Dijilly Sidibé");
    expect(markup).toContain("Anaïs Martin");
    expect(markup).toContain("/jeu/coureurs/rider-1");
    expect(markup).toContain("/jeu/equipes/team-2");
    expect(markup).not.toContain("<iframe");
  });
});
