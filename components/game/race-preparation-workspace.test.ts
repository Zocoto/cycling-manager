import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "components/game/race-preparation-workspace.tsx"),
  "utf8",
);
const tacticsSource = readFileSync(
  join(process.cwd(), "lib/game/race-tactics.ts"),
  "utf8",
);

describe("race preparation individual missions", () => {
  it("consolidates leader protection into the race lieutenant", () => {
    expect(source).toContain('name="lieutenantRiderId"');
    expect(source).toContain(
      "Protège le leader et l’accompagne dans les moments décisifs.",
    );
    expect(source).not.toContain('name="protectorRiderId"');
    expect(source).not.toContain('label="Protecteur du leader"');
  });

  it("recovers a legacy protector as the lieutenant when editing a plan", () => {
    expect(source).toContain(
      "strategy.lieutenantRiderId ?? strategy.protectorRiderId ??",
    );
  });

  it("regroupe profil, préparatifs et équipements sous chaque étape", () => {
    expect(source).toContain("<StageProfileOverview stage={stage} />");
    expect(source).toContain("Préparatifs sportifs");
    expect(source).toContain("<StageEquipmentSection");
    expect(source).not.toContain("Un montage adapté à chaque étape");
  });

  it("ne monte le formulaire complet que lorsque l’étape est ouverte", () => {
    expect(source).toContain("const [hasBeenOpened, setHasBeenOpened]");
    expect(source).toContain("useInitialDetailsOpen(initiallyOpen)");
    expect(source).toContain("ref={initializeDetailsElement}");
    expect(source).toContain("renderContent={hasBeenOpened}");
    expect(source).toContain("{hasBeenOpened ? (");
    expect(source).toContain("{renderContent ? (");
    expect(source).not.toContain("open={isOpen}");
    expect(source).not.toContain("defaultOpen={initiallyOpen}");
    expect(source.match(/<StageProfileOverview stage=\{stage\} \/>/g)).toHaveLength(
      2,
    );
  });

  it("n’amorce pas en arrière-plan toutes les préparations du calendrier", () => {
    expect(source).toContain(
      'href={`/jeu/preparation-course?course=${encodeURIComponent(edition.slug)}`}',
    );
    expect(source).not.toContain('import Link from "next/link"');
    expect(source).not.toContain("<Link");
  });

  it("fournit un plan neutre lorsqu’une étape inscrite n’a pas encore de stratégie", () => {
    expect(source).toContain("function resolveStagePreparationPlan(");
    expect(source).toContain("plan.stages[stageId] ?? {");
    expect(source).toContain("objective: DEFAULT_RACE_TEAM_STRATEGY.objective");
    expect(source).toContain("strategy={strategy}");
    expect(source).not.toContain(
      "strategy={selectedEdition.plan.stages[stage.id]}",
    );
  });

  it("compte uniquement les étapes dont la préparation n’est pas enregistrée", () => {
    expect(source).toContain("isRaceStagePreparationPending");
    expect(source).toContain("Toutes les étapes sont préparées");
    expect(source).not.toContain("const editableCount = edition.stages.filter");
  });

  it("neutralise et masque le briefing du Centre tactique", () => {
    expect(tacticsSource).toContain(
      "export const RACE_TACTICAL_DOCTRINES_ENABLED = false",
    );
    expect(source).toContain("RACE_TACTICAL_DOCTRINES_ENABLED ? (");
  });

  it("verrouille le leader déclaré pendant tout un tour", () => {
    expect(source).toContain('rider.generalRole === "leader"');
    expect(source).toContain("lockedLeaderRiderId: lockedTourLeaderRiderId");
    expect(source).toContain("Leader du tour · verrouillé");
    expect(source).toContain("Le leader annoncé à l’inscription reste leader");
  });

  it("rend leader et coureur protégé configurables sur un CLM par équipes", () => {
    expect(source).toContain("Noyau à préserver");
    expect(source).toContain("Leader et coureur protégé");
    expect(source).toContain('name="stageRoles"');
    expect(source).toContain("l’équipe ralentit pour le conserver");
  });
});
