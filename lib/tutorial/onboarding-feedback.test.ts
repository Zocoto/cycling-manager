import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("retours utilisateurs sur l’onboarding", () => {
  it("expose un formulaire d’inscription reconnaissable par les gestionnaires de mots de passe", () => {
    const form = read("components/auth/registration-form.tsx");

    expect(form).toContain('data-form-type="signup"');
    expect(form).toContain('autoComplete="username"');
    expect(form).toContain('autoComplete="new-password"');
    expect(form).toContain('type="password"');
  });

  it("rend l’aide globale flottante et contextuelle", () => {
    const layout = read("app/jeu/layout.tsx");
    const header = read("components/game/game-header.tsx");
    const menu = read("components/tutorial/tutorial-center-menu.tsx");

    expect(layout).toContain("<TutorialCenterLauncher />");
    expect(header).not.toContain("<TutorialCenterLauncher />");
    expect(menu).toContain("getContextualTutorialKey(pathname)");
    expect(menu).toContain("tutorial-floating-launcher");
  });

  it("saute les actions déjà terminées et distingue le repère d’identité", () => {
    const catalog = read("lib/tutorial/catalog.ts");
    const actions = read("app/jeu/tutorial-actions.ts");

    expect(catalog).toContain('landmarkLabel: "Finaliser votre identité"');
    expect(catalog).toContain(
      'skipWhenRequirementSatisfied: "profile_complete"',
    );
    expect(catalog).toContain(
      'skipWhenRequirementSatisfied: "team_created"',
    );
    expect(actions).toContain("getFirstIncompleteStep");
  });

  it("conserve le Critérium interactif pendant l’aide et corrige les textes", () => {
    const provider = read("components/tutorial/tutorial-provider.tsx");
    const catalog = read("lib/tutorial/catalog.ts");

    expect(provider).toContain(
      'localizedActiveTutorial.definition.type === "race_scenario"',
    );
    expect(catalog).toContain("Elle ne provoque aucune fatigue");
    expect(catalog).toContain(
      "Pour cet entraînement, la simulation est calculée immédiatement",
    );
    expect(catalog).not.toContain(
      "La différence reste invisible pour le moteur d’affichage",
    );
  });
});
