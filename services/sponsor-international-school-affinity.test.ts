import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const teamAffinitySource = readFileSync(
  new URL("./sponsor-team-affinity.ts", import.meta.url),
  "utf8",
);
const futureOffersSource = readFileSync(
  new URL("./future-sponsor-offers.ts", import.meta.url),
  "utf8",
);
const persistedOffersSource = readFileSync(
  new URL("./persisted-sponsor-offers.ts", import.meta.url),
  "utf8",
);

describe("international school sponsor affinity wiring", () => {
  it("loads only the team's completed international schools", () => {
    expect(teamAffinitySource).toContain('.from("international_youth_centers")');
    expect(teamAffinitySource).toContain('.eq("team_id", teamId)');
    expect(teamAffinitySource).toContain("internationalSchoolAffinities");
  });

  it("regenerates old future offers and forwards school affinities", () => {
    expect(futureOffersSource).toContain(
      "const INTERNATIONAL_SCHOOL_OFFER_GENERATION_VERSION = 9",
    );
    expect(futureOffersSource).toContain(
      "countryAffinity.internationalSchoolAffinities",
    );
    expect(persistedOffersSource).toContain(
      "const INTERNATIONAL_SCHOOL_OFFER_GENERATION_VERSION = 9",
    );
    expect(persistedOffersSource).toContain(
      "countryAffinity.internationalSchoolAffinities",
    );
  });

  it("forwards the sporting director country to every sponsor draw", () => {
    expect(teamAffinitySource).toContain("directorCountryCode");
    expect(teamAffinitySource).toContain("directorCountryId");
    expect(futureOffersSource).toContain(
      "directorCountryCode: countryAffinity.directorCountryCode",
    );
    expect(persistedOffersSource).toContain(
      "directorCountryCode: countryAffinity.directorCountryCode",
    );
    expect(futureOffersSource).toContain(
      "const DIRECTOR_COUNTRY_OFFER_GENERATION_VERSION = 10",
    );
  });
});
