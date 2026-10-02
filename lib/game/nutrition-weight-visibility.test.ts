import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const healthPage = readFileSync(
  join(process.cwd(), "app/jeu/centre-de-soin/page.tsx"),
  "utf8",
);
const nutritionEditor = readFileSync(
  join(
    process.cwd(),
    "components/game/nutrition-interventions-editor.tsx",
  ),
  "utf8",
);

describe("nutrition weight visibility", () => {
  it("affiche la taille, le poids et son évolution saisonnière sur chaque ligne de coureur", () => {
    expect(healthPage).toContain('Taille {rider.heightCm.toLocaleString("fr-FR")} cm');
    expect(healthPage).toContain("Poids {rider.weightKg.toLocaleString");
    expect(healthPage).toContain("Évolution du poids sur la saison");
    expect(healthPage).toContain('rider.seasonWeightDeltaKg > 0');
    expect(healthPage).toContain('text-[#C5483D]');
    expect(healthPage).toContain('text-[#2F6FB5]');
    expect(healthPage).toContain("riderWeightKg={rider.weightKg}");
  });

  it("annonce le risque et le gain de poids du complément sélectionné", () => {
    expect(nutritionEditor).toContain("Impact poids ·");
    expect(nutritionEditor).toContain("kg si déclenché");
    expect(nutritionEditor).toContain("getNutritionWeightGainRiskPct");
  });

  it("garde l’affûtage compact sans répéter les mesures du coureur", () => {
    expect(healthPage).toContain('className="mt-3 grid gap-2 rounded-xl');
    expect(healthPage).toContain("Tous les 5 j");
    expect(healthPage).toContain("pendingLabel=\"Affûtage…\"");
    expect(healthPage).not.toContain("Programme d’affûtage · {rider.heightCm");
  });
});
