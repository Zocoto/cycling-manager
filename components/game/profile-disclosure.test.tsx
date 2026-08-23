import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProfileDisclosure } from "./profile-disclosure";

describe("profile disclosure", () => {
  it("reste replié au premier affichage tout en conservant son contenu", () => {
    const markup = renderToStaticMarkup(
      <ProfileDisclosure
        title="Palmarès et historique"
        description="Résultats et saisons"
      >
        <p>Contenu complet</p>
      </ProfileDisclosure>,
    );

    expect(markup).toContain("<details");
    expect(markup).not.toContain("<details open");
    expect(markup).toContain("Palmarès et historique");
    expect(markup).toContain("Dérouler");
    expect(markup).toContain("Contenu complet");
  });
});
