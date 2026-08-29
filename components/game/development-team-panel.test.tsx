import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DevelopmentResultRiderLink } from "./development-team-panel";

describe("DevelopmentResultRiderLink", () => {
  it("ouvre la fiche d’un junior adverse lorsqu’il est rattaché à une DevTeam", () => {
    const markup = renderToStaticMarkup(
      <DevelopmentResultRiderLink
        result={{
          academyRiderId: "4d317908-d942-4e1a-8d75-4f464ef7c49b",
          riderName: "Junior rival",
        }}
      />,
    );

    expect(markup).toContain(
      'href="/jeu/centre-de-formation/development/4d317908-d942-4e1a-8d75-4f464ef7c49b"',
    );
    expect(markup).toContain("Junior rival");
  });

  it("laisse les participants simulés sans fiche en simple texte", () => {
    const markup = renderToStaticMarkup(
      <DevelopmentResultRiderLink
        result={{ academyRiderId: null, riderName: "Junior simulé" }}
      />,
    );

    expect(markup).toBe("Junior simulé");
  });
});
