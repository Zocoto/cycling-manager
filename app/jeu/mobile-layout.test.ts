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
});
