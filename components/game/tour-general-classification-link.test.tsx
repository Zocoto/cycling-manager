import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TourGeneralClassificationLink } from "./tour-general-classification-link";

describe("TourGeneralClassificationLink", () => {
  it("ouvre directement le classement général de la dernière étape classée", () => {
    const markup = renderToStaticMarkup(
      <TourGeneralClassificationLink
        editionSlug="tour-test"
        stageNumber={3}
      />,
    );

    expect(markup).toContain(
      'href="/jeu/resultats/tour-test/3?classement=general"',
    );
    expect(markup).toContain("Classement général");
  });
});