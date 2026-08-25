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

describe("progression de l'objectif sponsor de nationalité", () => {
  it("réutilise la progression persistée et indexée du contrat", () => {
    expect(workflowSource).toContain('.from("objective_progress")');
    expect(workflowSource).toContain(
      '.eq("team_sponsor_contract_id", contractId)',
    );
    expect(workflowSource).toContain(
      '.in("sponsor_objective_id", objectiveIds)',
    );
  });

  it("charge la progression en parallèle du rafraîchissement déjà existant", () => {
    expect(workflowSource).toContain(
      "[objectivesByOffer, currentValuesByObjectiveId] = await Promise.all([",
    );
  });

  it("affiche le pourcentage courant uniquement pour l'objectif de nationalité", () => {
    expect(pageSource).toContain(
      'objective.targetDetails.kind === "nationality_quota"',
    );
    expect(pageSource).toContain("Effectif actuel :");
    expect(pageSource).toContain("formatSponsorPercentage");
  });
});
