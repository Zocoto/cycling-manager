import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WelcomeOfferSpotlight } from "./welcome-offer-spotlight";

const offer = {
  code: "welcome_week_2026_09",
  startsAt: "2026-09-19T08:00:00.000Z",
  endsAt: "2026-09-26T08:00:00.000Z",
  extraStartingCash: 5000,
  totalStartingCash: 15000,
  scoutLevel: 3,
};

describe("welcome offer spotlight", () => {
  it("présente sans ambiguïté le budget, le scout et la limite", () => {
    const markup = renderToStaticMarkup(
      <WelcomeOfferSpotlight
        offer={offer}
        locale="fr"
        placement="homepage"
      />,
    );

    expect(markup).toContain("Cadeau de bienvenue");
    expect(markup).toContain("15 000 €");
    expect(markup).toContain("scout niveau 3");
    expect(markup).toContain("5 000 € de budget initial supplémentaire");
    expect(markup).toContain("salaire saisonnier normal");
    expect(markup).toContain("utm_campaign=welcome_week_2026_09");
  });

  it("ne rajoute pas de second appel à l’action dans l’inscription", () => {
    const markup = renderToStaticMarkup(
      <WelcomeOfferSpotlight
        offer={offer}
        locale="fr"
        placement="registration"
      />,
    );

    expect(markup).not.toContain("Créer mon équipe");
  });
});
