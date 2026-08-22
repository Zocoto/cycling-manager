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

describe("mobile game shell", () => {
  it("cantonne les ajustements au jeu et aux petits écrans", () => {
    expect(layoutSource).toContain('import "./mobile.css"');
    expect(layoutSource).toContain('className="game-shell"');
    expect(mobileStyles).toContain("@media (max-width: 639px)");
    expect(mobileStyles).toContain(".game-shell");
  });

  it("réserve la place du dock sans provoquer de débordement horizontal", () => {
    expect(mobileStyles).toContain("safe-area-inset-bottom");
    expect(mobileStyles).toContain("overflow-x: clip");
    expect(mobileStyles).toContain("font-size: 16px");
  });

  it("positionne le chat en bulle et anime les panneaux applicatifs", () => {
    expect(mobileStyles).toContain(".game-shell .mobile-chat-bubble");
    expect(mobileStyles).toContain("position: fixed");
    expect(mobileStyles).toContain(".game-shell .mobile-app-sheet");
    expect(mobileStyles).toContain(
      "bottom: calc(4.75rem + env(safe-area-inset-bottom))",
    );
    expect(mobileStyles).toContain("@keyframes mobile-app-sheet-in");
    expect(mobileStyles).toContain("prefers-reduced-motion: reduce");
  });
});
