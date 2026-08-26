import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SECTION_TAB_FILES = [
  "app/jeu/objectifs/page.tsx",
  "app/jeu/centre-de-formation/page.tsx",
  "app/jeu/infrastructures/page.tsx",
  "app/jeu/entrainement/page.tsx",
  "app/jeu/finances/page.tsx",
  "app/jeu/centre-de-soin/page.tsx",
  "app/jeu/transferts/page.tsx",
  "app/jeu/staff/page.tsx",
  "app/jeu/effectif/page.tsx",
  "app/jeu/classements/page.tsx",
  "components/game/material-navigation.tsx",
  "components/game/fan-club.tsx",
  "components/game/development-team-panel.tsx",
] as const;

describe("adoption de la navigation commune des rubriques", () => {
  it.each(SECTION_TAB_FILES)("utilise GameSectionTabs dans %s", (filePath) => {
    const source = readFileSync(join(process.cwd(), filePath), "utf8");

    expect(source).toContain("<GameSectionTabs");
  });
});
