import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const trainingPage = readFileSync(
  join(process.cwd(), "app/jeu/entrainement/page.tsx"),
  "utf8",
);
const trainingControls = readFileSync(
  join(process.cwd(), "components/game/training-controls.tsx"),
  "utf8",
);
const trainingReports = readFileSync(
  join(process.cwd(), "components/game/training-report-popover.tsx"),
  "utf8",
);
const reconnaissancePlanner = readFileSync(
  join(process.cwd(), "components/game/race-reconnaissance-planner.tsx"),
  "utf8",
);
const tutorialCenter = readFileSync(
  join(process.cwd(), "components/tutorial/tutorial-center-menu.tsx"),
  "utf8",
);

describe("training tutorial page targets", () => {
  it("propose le lancement contextuel et la reprise sur les deux onglets", () => {
    expect(trainingPage).toContain(
      "tutorialKey={TRAINING_TUTORIAL_KEY}",
    );
    expect(trainingPage).toContain("<TutorialRouteResume");
    expect(trainingPage).toContain(
      "TRAINING_RECONNAISSANCE_TUTORIAL_ROUTE",
    );
  });

  it("expose les sections collectives et le premier programme individuel", () => {
    for (const targetId of [
      "training-overview",
      "training-threshold",
      "training-staff",
    ]) {
      expect(trainingPage).toContain(`data-tutorial-id="${targetId}"`);
    }

    expect(trainingPage).toContain(
      'riderIndex === 0 ? "training-plan" : undefined',
    );
    for (const suffix of ["setup", "intensity", "domain", "trainer"]) {
      expect(trainingControls).toContain(
        "`${tutorialTargetPrefix}-" + suffix + "`",
      );
    }
    expect(trainingControls).toContain(
      'data-tutorial-id="training-plan-save"',
    );
  });

  it("rend le rapport ciblable même avant la première séance", () => {
    expect(trainingPage).toContain(
      'riderIndex === 0 ? "training-report" : undefined',
    );
    expect(trainingReports).toContain(
      "data-tutorial-id={tutorialTargetId}",
    );
  });

  it("expose toutes les étapes du planificateur de reconnaissance", () => {
    for (const targetId of [
      "reconnaissance-overview",
      "reconnaissance-rider-selection",
      "reconnaissance-course-selection",
      "reconnaissance-date-planning",
      "reconnaissance-validation",
    ]) {
      expect(reconnaissancePlanner).toContain(
        `data-tutorial-id="${targetId}"`,
      );
    }
  });

  it("ajoute le parcours au Centre des didacticiels", () => {
    expect(tutorialCenter).toContain("TRAINING_TUTORIAL_KEY");
    expect(tutorialCenter).toContain(
      'title="Entraînement et reconnaissance"',
    );
  });
});