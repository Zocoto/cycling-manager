import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const youthPage = readFileSync(
  join(process.cwd(), "app/jeu/centre-de-formation/page.tsx"),
  "utf8",
);
const scoutingMap = readFileSync(
  join(process.cwd(), "components/game/youth-scouting-map.tsx"),
  "utf8",
);
const miniGame = readFileSync(
  join(process.cwd(), "components/game/youth-training-mini-game.tsx"),
  "utf8",
);
const tutorialCenter = readFileSync(
  join(process.cwd(), "components/tutorial/tutorial-center-menu.tsx"),
  "utf8",
);

describe("youth development tutorial integration", () => {
  it("propose le lancement contextuel et la reprise sur les deux onglets", () => {
    expect(youthPage).toContain(
      "tutorialKey={YOUTH_DEVELOPMENT_TUTORIAL_KEY}",
    );
    expect(youthPage).toContain("<TutorialRouteResume");
    expect(youthPage).toContain("YOUTH_DEVELOPMENT_ACADEMY_ROUTE");
  });

  it("expose les cibles de la carte et de la mission fictive", () => {
    for (const targetId of [
      "youth-tutorial-map",
      "youth-tutorial-filters",
      "youth-tutorial-mission-launch",
    ]) {
      expect(scoutingMap).toContain(`data-tutorial-id="${targetId}"`);
    }
  });

  it("expose le rapport, l’école et les réglages", () => {
    for (const targetId of [
      "youth-tutorial-deadlines",
      "youth-tutorial-report",
      "youth-tutorial-signing",
      "youth-tutorial-academy",
      "youth-tutorial-training-settings",
      "youth-tutorial-minigame",
    ]) {
      expect(youthPage).toContain(`data-tutorial-id="${targetId}"`);
    }
  });

  it("garantit que le minijeu de démonstration ne contacte pas le serveur", () => {
    expect(miniGame).toContain("demoMode = false");
    expect(miniGame).toContain("if (demoMode)");
    expect(miniGame).toContain("Démonstration terminée");
  });

  it("ajoute le parcours au Centre des didacticiels", () => {
    expect(tutorialCenter).toContain("YOUTH_DEVELOPMENT_TUTORIAL_KEY");
    expect(tutorialCenter).toContain("Former les talents de demain");
  });
});
