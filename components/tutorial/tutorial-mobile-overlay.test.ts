import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const overlaySource = readFileSync(
  join(process.cwd(), "components/tutorial/tutorial-overlay.tsx"),
  "utf8",
);

describe("tutorial mobile overlay", () => {
  it("restaure un volet bas compact qui laisse la page et la cible visibles", () => {
    expect(overlaySource).toContain("const MOBILE_BREAKPOINT = 640");
    expect(overlaySource).toContain("max-h-[36dvh]");
    expect(overlaySource).toContain(
      'isMobile ? "mobile-sheet" : panelPosition.placement',
    );
    expect(overlaySource).toContain("reservedBottom");
    expect(overlaySource).toContain("window.scrollBy(0, reservedBottom / 2)");
    expect(overlaySource).toContain("min-h-0 flex-1 overflow-y-auto");
  });

  it("allège le masque mobile sans casser l’interaction avec la cible", () => {
    expect(overlaySource).toContain(
      "max-sm:bg-[#071A17]/45 max-sm:backdrop-blur-none",
    );
    expect(overlaySource).toContain(
      'pointerEvents: step.allowTargetInteraction ? "none" : "auto"',
    );
  });

  it("conserve le bouton d’enchaînement ajouté après le correctif historique", () => {
    expect(overlaySource).toContain("onFollowUp");
    expect(overlaySource).toContain("Parcours suivant");
  });
});
