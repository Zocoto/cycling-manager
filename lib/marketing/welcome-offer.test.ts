import { describe, expect, it } from "vitest";

import {
  buildWelcomeOfferSignupHref,
  normalizeActivePublicWelcomeOffer,
} from "./welcome-offer";

const row = {
  campaign_code: "welcome_week_2026_09",
  starts_at: "2026-09-19T08:00:00.000Z",
  ends_at: "2026-09-26T08:00:00.000Z",
  extra_starting_cash: "5000",
  scout_level: 3,
};

describe("public welcome offer", () => {
  it("normalise le cadeau actif avec le budget de départ total", () => {
    expect(
      normalizeActivePublicWelcomeOffer(
        [row],
        new Date("2026-09-20T08:00:00.000Z"),
      ),
    ).toEqual({
      code: "welcome_week_2026_09",
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      extraStartingCash: 5000,
      totalStartingCash: 15000,
      scoutLevel: 3,
    });
  });

  it("cesse toute communication dès l’expiration réelle", () => {
    expect(
      normalizeActivePublicWelcomeOffer(
        [row],
        new Date("2026-09-26T08:00:00.000Z"),
      ),
    ).toBeNull();
  });

  it("attribue le clic de l’accueil à la campagne active", () => {
    const href = buildWelcomeOfferSignupHref(
      { code: "welcome_week_2026_09" },
      "homepage_spotlight",
    );

    expect(href).toContain("/inscription?");
    expect(href).toContain("utm_campaign=welcome_week_2026_09");
    expect(href).toContain("utm_content=homepage_spotlight");
  });
});
