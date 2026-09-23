import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  TUTORIAL_CENTER_QUERY_PARAMETER,
  TUTORIAL_CENTER_ROUTE,
  shouldOpenTutorialCenter,
} from "@/lib/tutorial/tutorial-center-route";

describe("tutorial center deep link", () => {
  it("expose une route stable qui demande l'ouverture du centre", () => {
    expect(TUTORIAL_CENTER_QUERY_PARAMETER).toBe("centre-didacticiels");
    expect(TUTORIAL_CENTER_ROUTE).toBe("/jeu?centre-didacticiels=1");
    expect(
      shouldOpenTutorialCenter(
        new URLSearchParams("centre-didacticiels=1"),
      ),
    ).toBe(true);
    expect(shouldOpenTutorialCenter(new URLSearchParams())).toBe(false);
  });

  it("dirige l'objectif historique vers les didacticiels plutôt que le profil du DS", () => {
    const objectivesPage = readFileSync(
      resolve(process.cwd(), "app/jeu/objectifs/page.tsx"),
      "utf8",
    );

    expect(objectivesPage).toContain(
      'objective.key === "complete_tutorial"',
    );
    expect(objectivesPage).toContain("? groupLinks.tutorials");
    expect(objectivesPage).toContain("href: TUTORIAL_CENTER_ROUTE");
  });

  it("active puis rouvre le menu lorsque la route dédiée est visitée", () => {
    const launcher = readFileSync(
      resolve(
        process.cwd(),
        "components/tutorial/tutorial-center-launcher.tsx",
      ),
      "utf8",
    );
    const menu = readFileSync(
      resolve(process.cwd(), "components/tutorial/tutorial-center-menu.tsx"),
      "utf8",
    );

    expect(launcher).toContain(
      "const openRequested = shouldOpenTutorialCenter(searchParams)",
    );
    expect(launcher).toContain("if (activated || openRequested)");
    expect(launcher).toContain("initiallyOpen onClose={closeMenu}");
    expect(menu).toContain("const closeMenu = useCallback(() => {");
    expect(menu).toContain("onClose?.()");
  });
});
