import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RiderClimateProfileCard } from "./rider-climate-profile-card";

describe("RiderClimateProfileCard", () => {
  it("présente clairement la météo favorite et la météo difficile", () => {
    const markup = renderToStaticMarkup(
      <RiderClimateProfileCard
        profile={{ strength: "rain", weakness: "heat" }}
      />,
    );

    expect(markup).toContain("Affinités météo");
    expect(markup).toContain("Favorite");
    expect(markup).toContain("Pluie");
    expect(markup).toContain("Difficile");
    expect(markup).toContain("Forte chaleur");
    expect(markup).toContain("grid-cols-2");
    expect(markup).not.toContain("Rendement renforcé");
    expect(markup).not.toContain("Rendement réduit");
  });

  it("est raccordé à la fiche coureur et au profil climatique du moteur", () => {
    const pageSource = readFileSync(
      join(process.cwd(), "app/jeu/coureurs/[identifiant]/page.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("getRiderClimateProfile({");
    expect(pageSource).toContain(
      "<RiderClimateProfileCard profile={riderClimateProfile} />",
    );
  });
});
