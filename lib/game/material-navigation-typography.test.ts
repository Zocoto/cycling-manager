import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const navigation = readFileSync(
  resolve(process.cwd(), "components/game/material-navigation.tsx"),
  "utf8",
);

const materialPages = [
  "app/jeu/materiel/page.tsx",
  "app/jeu/materiel/equipementier/page.tsx",
  "app/jeu/materiel/laboratoire/page.tsx",
  "app/jeu/materiel/equiper/page.tsx",
];

describe("material navigation typography", () => {
  it("utilise la navigation graphique commune avec un sous-titre lisible", () => {
    expect(navigation).toContain("<GameSectionTabs");
    expect(navigation).toContain("<GameSectionTabLink");
    expect(navigation).toContain("Catalogue et achats");
    expect(navigation).not.toContain("text-[10px]");
  });

  it.each(materialPages)("shares the navigation on %s", (pagePath) => {
    const page = readFileSync(resolve(process.cwd(), pagePath), "utf8");

    expect(page).toContain(
      'import { MaterialNavigation } from "@/components/game/material-navigation";',
    );
  });
});
