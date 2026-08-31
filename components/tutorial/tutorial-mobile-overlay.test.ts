import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const overlaySource = readFileSync(
  join(process.cwd(), "components/tutorial/tutorial-overlay.tsx"),
  "utf8",
);

const providerSource = readFileSync(
  join(process.cwd(), "components/tutorial/tutorial-provider.tsx"),
  "utf8",
);

describe("tutorial mobile overlay", () => {
  it("restaure un volet bas compact qui laisse la page et la cible visibles", () => {
    expect(overlaySource).toContain("const MOBILE_BREAKPOINT = 640");
    expect(overlaySource).toContain("max-h-[30dvh]");
    expect(overlaySource).toContain('"mobile-sheet"');
    expect(overlaySource).toContain('"informative-dock"');
    expect(overlaySource).toContain("reservedBottom");
    expect(overlaySource).toContain("rectangle.top - desiredTop");
    expect(overlaySource).toContain(
      "fitTutorialTargetRectangleToVisibleArea",
    );
    expect(overlaySource).toContain("min-h-0 flex-1 overflow-y-auto");
  });

  it("allège le masque mobile sans casser l’interaction avec la cible", () => {
    expect(overlaySource).toContain(
      "max-sm:bg-[#071A17]/45 max-sm:backdrop-blur-none",
    );
    expect(overlaySource).toContain(
      'isInformative || step.allowTargetInteraction ? "none" : "auto"',
    );
    expect(overlaySource).toContain(
      "isInformative || (isMobile && step.allowTargetInteraction)",
    );
  });

  it("présente l’onboarding comme un repère informatif non bloquant", () => {
    expect(overlaySource).toContain('presentation === "informative"');
    expect(overlaySource).toContain("step.landmarkLabel");
    expect(overlaySource).toContain("border-[#D94B57]");
    expect(overlaySource).toContain(
      'role={isInformative ? "region" : "dialog"}',
    );
    expect(overlaySource).toContain('data-tutorial-presentation={presentation}');
    expect(providerSource).toContain(
      'localizedActiveTutorial.definition.type === "onboarding" ||',
    );
    expect(providerSource).toContain(
      'localizedActiveTutorial.definition.type === "race_scenario"',
    );
    expect(providerSource).toContain('? "informative"');
  });

  it("ne vole pas le focus et se range pendant une sous-fenêtre", () => {
    expect(overlaySource).toContain("if (!isInformative)");
    expect(overlaySource).toContain("isSuspendedByDialog");
    expect(overlaySource).toContain('data-tutorial-suspended=');
    expect(overlaySource).toContain("right: 12");
    expect(overlaySource).toContain("bottom: 12");
  });

  it("place le repère à côté des contrôles interactifs", () => {
    expect(overlaySource).toContain("shouldDockInformativePanel");
    expect(overlaySource).toContain(
      "isInformative && !step.allowTargetInteraction",
    );
  });

  it("attend brièvement une cible rendue après la navigation", () => {
    expect(overlaySource).toContain("targetDiscoveryObserver");
    expect(overlaySource).toContain("childList: true");
    expect(overlaySource).toContain("subtree: true");
    expect(overlaySource).toContain("observeTargetElement(discoveredTarget)");
    expect(overlaySource).toContain("recenterTargetElement(discoveredTarget)");
  });

  it("bloque Suivant uniquement jusqu’à l’action demandée", () => {
    expect(overlaySource).toContain("step.requiresTargetCompletion");
    expect(overlaySource).toContain("data-tutorial-complete");
    expect(overlaySource).toContain("data-tutorial-next-ready");
    expect(overlaySource).toContain("Action à compléter");
  });

  it("utilise une cible dédiée sur téléphone lorsqu’elle existe", () => {
    expect(overlaySource).toContain("step.mobileTargetId");
    expect(overlaySource).toContain("? step.mobileTargetId");
  });

  it("conserve le bouton d’enchaînement ajouté après le correctif historique", () => {
    expect(overlaySource).toContain("onFollowUp");
    expect(overlaySource).toContain("Parcours suivant");
  });
});
