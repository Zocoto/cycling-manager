import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const workflowSource = readFileSync(
  resolve(process.cwd(), "services/sponsoring-workflow.ts"),
  "utf8",
);
const pageSource = readFileSync(
  resolve(process.cwd(), "app/jeu/sponsoring/page.tsx"),
  "utf8",
);

describe("progression des objectifs sponsor", () => {
  it("réutilise la progression persistée et indexée du contrat", () => {
    expect(workflowSource).toContain('.from("objective_progress")');
    expect(workflowSource).toContain(
      '.eq("team_sponsor_contract_id", contractId)',
    );
    expect(workflowSource).toContain(
      '.in("sponsor_objective_id", objectiveIds)',
    );
  });

  it("charge toutes les progressions en parallèle du rafraîchissement déjà existant", () => {
    expect(workflowSource).toContain(
      "[objectivesByOffer, progressByObjectiveId] = await Promise.all([",
    );
    expect(workflowSource).toContain(
      '.select("sponsor_objective_id, current_value, status, details")',
    );
  });

  it("affiche une jauge générique tout en conservant le format des pourcentages", () => {
    expect(pageSource).toContain("getSponsorObjectiveProgressDisplay");
    expect(pageSource).toContain("SponsorObjectiveProgressGauge");
    expect(pageSource).toContain("formatSponsorPercentage");
  });

  it("rend le classement final et le bonus de réussite partielle explicites", () => {
    expect(pageSource).toContain("Résultat obtenu :");
    expect(pageSource).toContain("Petite satisfaction :");
    expect(pageSource).toContain("objective.partialSatisfactionPoints");
  });
});
