import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const federationPage = readFileSync(
  join(process.cwd(), "app/jeu/federations/[codePays]/page.tsx"),
  "utf8",
);
const currentFederationPage = readFileSync(
  join(process.cwd(), "app/jeu/federation/page.tsx"),
  "utf8",
);
const nationPage = readFileSync(
  join(process.cwd(), "app/jeu/nations/[codePays]/page.tsx"),
  "utf8",
);

describe("federation pages", () => {
  it("resolves the current team federation from its sporting nationality", () => {
    expect(currentFederationPage).toContain(
      "getCurrentTeamFederationCountryCode",
    );
    expect(currentFederationPage).toContain(
      "redirect(`/jeu/federations/${countryCode.toLowerCase()}`)",
    );
  });

  it("limits the visible federation entry point to the Belgian beta", () => {
    expect(nationPage).toContain("Découvrir la fédération");
    expect(nationPage).toContain('country.country_code.toUpperCase() === "BE"');
    expect(nationPage).toContain('href="/jeu/federations/be"');
  });

  it("loads one compact read-only snapshot for the selected nation", () => {
    expect(federationPage).toContain("getNationalFederationSnapshot");
    expect(federationPage).toContain("NationalFederationView");
    expect(federationPage).not.toContain("action=");
  });
});
