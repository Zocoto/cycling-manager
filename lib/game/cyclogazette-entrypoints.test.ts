import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(join(process.cwd(), "app/jeu/page.tsx"), "utf8");
const header = readFileSync(
  join(process.cwd(), "components/game/game-header.tsx"),
  "utf8",
);

describe("points d’accès à La Cyclogazette", () => {
  it("ne propose plus La Cyclogazette parmi les tuiles du bureau du DS", () => {
    expect(dashboard).not.toContain('href="/jeu/gazette"');
    expect(dashboard).not.toContain('icon="gazette"');
  });

  it("conserve son raccourci dans le header", () => {
    expect(header).toContain("<CyclogazetteShortcut />");
    expect(header).toContain('href="/jeu/gazette"');
    expect(header).toContain('aria-label="Lire La Cyclogazette"');
  });
});
