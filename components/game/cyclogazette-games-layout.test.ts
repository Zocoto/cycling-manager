import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const gazettePage = readFileSync(
  join(process.cwd(), "app/jeu/gazette/page.tsx"),
  "utf8",
);
const newspaper = readFileSync(
  join(process.cwd(), "components/game/cyclogazette-newspaper.tsx"),
  "utf8",
);
const gamesSection = readFileSync(
  join(process.cwd(), "components/game/cyclogazette-games-sidebar.tsx"),
  "utf8",
);

describe("mise en page des jeux de La Cyclogazette", () => {
  it("intègre les jeux dans le journal avant les commentaires", () => {
    expect(gazettePage).toContain("gamesSection={");
    expect(newspaper.indexOf("{gamesSection ? (")).toBeGreaterThan(-1);
    expect(newspaper.indexOf("{gamesSection ? (")).toBeLessThan(
      newspaper.indexOf("{community ? ("),
    );
  });

  it("reste en colonne sur mobile et ne se dédouble que sur grand écran", () => {
    expect(gamesSection).toContain(
      "grid lg:grid-cols-[minmax(0,1.55fr)_minmax(290px,0.85fr)]",
    );
    expect(gamesSection).not.toContain("xl:sticky");
    expect(gamesSection).not.toContain("shadow-[0_28px_70px");
  });
});
