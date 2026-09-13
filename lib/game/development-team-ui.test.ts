import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const centerPage = readFileSync(
  join(process.cwd(), "app/jeu/centre-de-formation/page.tsx"),
  "utf8",
);
const panel = readFileSync(
  join(process.cwd(), "components/game/development-team-panel.tsx"),
  "utf8",
);
const builder = readFileSync(
  join(process.cwd(), "components/game/development-team-builder.tsx"),
  "utf8",
);
const rosterEditor = readFileSync(
  join(process.cwd(), "components/game/development-team-roster-editor.tsx"),
  "utf8",
);
const riderProfile = readFileSync(
  join(process.cwd(), "components/game/development-rider-visible-profile.tsx"),
  "utf8",
);
const riderPage = readFileSync(
  join(
    process.cwd(),
    "app/jeu/centre-de-formation/development/[academyRiderId]/page.tsx",
  ),
  "utf8",
);

describe("Development Team UI", () => {
  it("remplace le placeholder par quatre sous-rubriques jouables", () => {
    expect(centerPage).toContain("getDevelopmentTeamOverview");
    expect(centerPage).toContain("<DevelopmentTeamPanel");
    expect(centerPage).not.toContain("<DevelopmentTab />");
    for (const view of ["effectif", "calendrier", "resultats", "maillot"]) {
      expect(panel).toContain(view);
    }
  });

  it("permet la composition de l’effectif et le dessin du maillot", () => {
    expect(builder).toContain("MAXIMUM_ROSTER_SIZE = 11");
    expect(builder).toContain("DevelopmentRiderSelectionCard");
    expect(rosterEditor).toContain("DevelopmentRiderSelectionCard");
    expect(builder).toContain("AMATEUR_JERSEY_PATTERNS.map");
    expect(builder).toContain("Fonder l’équipe de développement");
  });

  it("montre toutes les notes, le potentiel et le talent lors du choix", () => {
    expect(panel).toContain("DevelopmentRiderVisibleProfile");
    expect(riderProfile).toContain("RIDER_RATING_AXES.map");
    expect(riderProfile).toContain("rider.ratings[axis.key]");
    expect(riderProfile).toContain("PotentialStars");
    expect(riderProfile).toContain("Talent natif");
    expect(riderProfile).toContain("nativeSpecialAbility.effect");
  });

  it("expose le calendrier, les inscriptions et les résultats bruts", () => {
    expect(panel).toContain("registerDevelopmentRaceAction");
    expect(panel).toContain("Dix rendez-vous, des résultats au fil des jours");
    expect(panel).toContain("Résultats bruts");
    expect(panel).toContain("Classement général final");
    expect(panel).toContain("formatRaceTime");
  });

  it("crée une fiche junior cohérente avec les fiches professionnelles", () => {
    expect(riderPage).toContain("<RiderStatsRadar");
    expect(riderPage).toContain("<RiderClimateProfileCard");
    expect(riderPage).toContain("<PotentialStars");
    expect(riderPage).toContain("Historique des saisons");
    expect(riderPage).toContain("Année junior");
    expect(riderPage).toContain("Palmarès junior détaillé");
  });
});
