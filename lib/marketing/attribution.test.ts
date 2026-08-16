import { describe, expect, it } from "vitest";

import {
  buildMarketingHref,
  readMarketingAttribution,
} from "./attribution";

describe("attribution marketing", () => {
  it("conserve uniquement les paramètres UTM reconnus", () => {
    expect(
      readMarketingAttribution({
        utm_source: "instagram",
        utm_medium: ["social", "ignored"],
        utm_campaign: "saison2_beta",
        unexpected: "discarded",
      }),
    ).toEqual({
      utm_source: "instagram",
      utm_medium: "social",
      utm_campaign: "saison2_beta",
    });
  });

  it("nettoie et limite les valeurs avant stockage", () => {
    expect(
      readMarketingAttribution({
        utm_content: `  reel\u0000${"x".repeat(120)}  `,
      }),
    ).toEqual({
      utm_content: `reel${"x".repeat(96)}`,
    });
  });

  it("construit un lien relatif encodé vers l’inscription", () => {
    expect(
      buildMarketingHref("/inscription", {
        utm_source: "instagram",
        utm_campaign: "saison 2",
      }),
    ).toBe(
      "/inscription?utm_source=instagram&utm_campaign=saison+2",
    );
  });
});
