import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(
  join(process.cwd(), "app/jeu/layout.tsx"),
  "utf8",
);
const mobileStyles = readFileSync(
  join(process.cwd(), "app/jeu/mobile.css"),
  "utf8",
);
const mobileNavigation = readFileSync(
  join(process.cwd(), "components/game/mobile-game-navigation.tsx"),
  "utf8",
);
const dockAwareControls = [
  "components/game/team-equipment-bulk-editor.tsx",
  "components/game/training-controls.tsx",
  "components/game/nutrition-interventions-editor.tsx",
  "components/game/youth-training-bulk-editor.tsx",
  "components/game/equipment-commercial-shop.tsx",
  "components/game/team-equipment-manager.tsx",
  "components/game/special-ability-medallion.tsx",
  "components/tutorial/tutorial-center-menu.tsx",
].map((path) => ({
  path,
  source: readFileSync(join(process.cwd(), path), "utf8"),
}));

describe("mobile game shell", () => {
  it("cantonne les ajustements au jeu et aux petits écrans", () => {
    expect(layoutSource).toContain('import "./mobile.css"');
    expect(layoutSource).toContain('className="game-shell"');
    expect(mobileStyles).toContain("@media (max-width: 639px)");
    expect(mobileStyles).toContain(".game-shell");
  });

  it("centralise la hauteur du dock et réserve sa place", () => {
    expect(mobileStyles).toContain("safe-area-inset-bottom");
    expect(mobileStyles).toContain("--game-mobile-navigation-height: 3.85rem");
    expect(mobileStyles).toContain("--game-mobile-navigation-edge-offset");
    expect(mobileStyles).toContain("--game-mobile-navigation-clearance");
    expect(mobileStyles).toContain(".game-shell .mobile-game-navigation-dock");
    expect(mobileNavigation).toContain("mobile-game-navigation-dock fixed");
    expect(mobileStyles).toContain("overflow-x: clip");
    expect(mobileStyles).toContain("font-size: 16px");
  });

  it("maintient tous les contrôles flottants au-dessus du dock", () => {
    expect(mobileStyles).toContain(".game-shell .mobile-dock-clearance");
    expect(mobileStyles).toContain(
      "bottom: var(--game-mobile-navigation-clearance)",
    );

    for (const control of dockAwareControls) {
      expect(control.source, control.path).toContain("mobile-dock-clearance");
    }
  });

  it("positionne le chat en bulle et anime les panneaux applicatifs", () => {
    expect(mobileStyles).toContain(".game-shell .mobile-chat-bubble");
    expect(mobileStyles).toContain("position: fixed");
    expect(mobileStyles).toContain(".game-shell .mobile-app-sheet");
    expect(mobileStyles).toContain("@keyframes mobile-app-sheet-in");
    expect(mobileStyles).toContain("prefers-reduced-motion: reduce");
  });
});
