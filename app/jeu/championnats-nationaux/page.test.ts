import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const page = readFileSync(
  join(process.cwd(), "app/jeu/championnats-nationaux/page.tsx"),
  "utf8",
);
const legacyPage = readFileSync(
  join(
    process.cwd(),
    "app/jeu/championnats-nationaux/[discipline]/page.tsx",
  ),
  "utf8",
);

describe("console unifiée des inscriptions aux CN", () => {
  it("affiche tout l’effectif dans une grille route et CLM", () => {
    expect(page).toContain("matrix.rows.map");
    expect(page).toContain("CN en ligne");
    expect(page).toContain("CN CLM");
    expect(page).toContain("name=\"road\"");
    expect(page).toContain("name=\"timeTrial\"");
  });

  it("explique le top 200 national et sauvegarde les deux colonnes ensemble", () => {
    expect(page).toContain("Top 200 national par défaut");
    expect(page).toContain("saveNationalChampionshipSelectionsAction");
  });

  it("indique pourquoi un coureur est indisponible pour chaque discipline", () => {
    expect(page).toContain("selection.unavailableReasons.map");
    expect(page).toContain("Blessé · indisponible au départ");
    expect(page).toContain("Déjà inscrit · {reason.raceName}");
    expect(page).toContain("aria-describedby");
  });

  it("redirige les anciennes pages par discipline vers la console unique", () => {
    expect(legacyPage).toContain(
      'redirect("/jeu/championnats-nationaux")',
    );
  });
});
