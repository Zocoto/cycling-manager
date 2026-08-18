import { describe, expect, it } from "vitest";

import { resolveTeamNationality } from "./team-nationality";

describe("nationalité sportive de l’équipe", () => {
  it("prend le pays du sponsor actif avant le pays amateur d’origine", () => {
    expect(
      resolveTeamNationality({
        sponsorCountryCode: "MA",
        amateurCountryCode: "NP",
        amateurCountryName: "Népal",
      }),
    ).toEqual({
      countryCode: "MA",
      countryName: "Maroc",
      source: "sponsor",
    });
  });

  it("conserve le pays amateur lorsqu’aucun sponsor n’est actif", () => {
    expect(
      resolveTeamNationality({
        sponsorCountryCode: null,
        amateurCountryCode: "NP",
        amateurCountryName: "Népal",
      }),
    ).toEqual({
      countryCode: "NP",
      countryName: "Népal",
      source: "amateur",
    });
  });
});
