import { describe, expect, it } from "vitest";

import {
  buildMarketingUnsubscribeUrl,
  buildOneClickMarketingUnsubscribeUrl,
  isMarketingUnsubscribeToken,
} from "./email-preferences";

const token = "8b5fa8a0-b4c9-4b7c-8f72-55953b24762f";

describe("préférences des e-mails d’actualité", () => {
  it("valide uniquement les jetons UUID", () => {
    expect(isMarketingUnsubscribeToken(token)).toBe(true);
    expect(isMarketingUnsubscribeToken("not-a-token")).toBe(false);
  });

  it("construit les liens de confirmation et de désinscription en un clic", () => {
    expect(
      buildMarketingUnsubscribeUrl({
        siteUrl: "https://cyclostratege.fr",
        token,
        locale: "en",
      }),
    ).toBe(
      "https://cyclostratege.fr/emails/desinscription?token=" +
        token +
        "&lang=en",
    );

    expect(
      buildOneClickMarketingUnsubscribeUrl({
        siteUrl: "https://cyclostratege.fr",
        token,
      }),
    ).toBe(
      "https://cyclostratege.fr/api/emails/desinscription?token=" + token,
    );
  });
});
