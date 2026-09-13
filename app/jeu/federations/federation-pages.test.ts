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
const nationsCupPage = readFileSync(
  join(process.cwd(), "app/jeu/nations-cup/page.tsx"),
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

  it("only exposes the federation management entry point on the viewer's own nation", () => {
    expect(nationPage).toContain("getCurrentTeamFederationCountryCode");
    expect(nationPage).toContain("canAccessNationalFederationManagement");
    expect(nationPage).toContain("canAccessFederationManagement ? (");
    expect(nationPage).toContain("Accéder à ma fédération");
    expect(nationPage).toContain(
      "href={`/jeu/federations/${country.country_code.toLowerCase()}`}",
    );
  });

  it("redirects foreign federation management URLs before loading management data", () => {
    expect(federationPage).toContain("getCurrentTeamFederationCountryCode");
    expect(federationPage).toContain("canAccessNationalFederationManagement");
    expect(federationPage).toContain(
      "redirect(`/jeu/nations/${country.country_code.toLowerCase()}`)",
    );
    expect(federationPage.indexOf("redirect(`/jeu/nations/")).toBeLessThan(
      federationPage.indexOf("getNationalFederationSnapshot({"),
    );
  });

  it("routes Nations Cup standings to public nation pages", () => {
    expect(nationsCupPage).toContain(
      "href={`/jeu/nations/${standing.countryCode.toLowerCase()}`}",
    );
    expect(nationsCupPage).not.toContain(
      "href={`/jeu/federations/${standing.countryCode.toLowerCase()}`}",
    );
  });

  it("loads the federation snapshot only for an authorized member", () => {
    expect(federationPage).toContain("getNationalFederationSnapshot");
    expect(federationPage).toContain("NationalFederationView");
    expect(federationPage).not.toContain("action=");
  });
});
