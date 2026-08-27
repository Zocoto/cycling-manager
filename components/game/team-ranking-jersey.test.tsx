import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TeamRankingJersey } from "./team-ranking-jersey";

describe("team ranking jersey", () => {
  it("affiche le maillot sponsorisé optimisé avec un lien vers l’équipe", () => {
    const markup = renderToStaticMarkup(
      <TeamRankingJersey
        teamId="team-1"
        teamName="Équipe Vélo"
        jersey={{
          kind: "sponsor",
          imagePath: "/images/sponsors/graphicool/jersey-modern.png",
        }}
      />
    );

    expect(markup).toContain('/jeu/equipes/team-1');
    expect(markup).toContain('aria-label="Voir l’équipe Équipe Vélo"');
    expect(markup).toContain(
      encodeURIComponent("/images/sponsors/graphicool/jersey-modern.png")
    );
    expect(markup).toContain('sizes="56px"');
  });

  it("dessine le maillot amateur avec ses couleurs", () => {
    const markup = renderToStaticMarkup(
      <TeamRankingJersey
        teamId="team-2"
        teamName="Les Grimpeurs"
        jersey={{
          kind: "amateur",
          jersey: {
            pattern: "diagonal",
            primaryColor: "#123456",
            secondaryColor: "#ABCDEF",
            accentColor: "#FEDCBA",
          },
        }}
      />
    );

    expect(markup).toContain("Maillot amateur de Les Grimpeurs");
    expect(markup).toContain("#123456");
    expect(markup).toContain("#ABCDEF");
    expect(markup).toContain("#FEDCBA");
  });
});
