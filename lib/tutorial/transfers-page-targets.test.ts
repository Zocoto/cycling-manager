import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const transferPage = readFileSync(
  join(process.cwd(), "app/jeu/transferts/page.tsx"),
  "utf8",
);

const tutorialCenter = readFileSync(
  join(
    process.cwd(),
    "components/tutorial/tutorial-center-menu.tsx",
  ),
  "utf8",
);

describe("transfer tutorial integration", () => {
  it("expose les cibles des trois sous-rubriques", () => {
    for (const targetId of [
      "transfer-overview",
      "transfer-tabs",
      "transfer-daily-overview",
      "transfer-daily-listings",
      "transfer-director-selling",
      "transfer-director-market",
      "transfer-free-agents-overview",
      "transfer-free-agent-filters",
      "transfer-free-agent-listings",
    ]) {
      expect(transferPage).toContain(`data-tutorial-id="${targetId}"`);
    }
  });

  it("propose le point d’interrogation et reprend le parcours en cours", () => {
    expect(transferPage).toContain(
      "tutorialKey={TRANSFER_TUTORIAL_KEY}",
    );
    expect(transferPage).toContain("<TutorialRouteResume");
    expect(transferPage).toContain("currentTransferTutorialRoute");
  });

  it("ajoute le parcours au Centre des didacticiels", () => {
    expect(tutorialCenter).toContain("TRANSFER_TUTORIAL_KEY");
    expect(tutorialCenter).toContain(
      "Maîtriser le Bureau des transferts",
    );
    expect(tutorialCenter).toContain("transferPresentation.statusLabel");
  });
});
