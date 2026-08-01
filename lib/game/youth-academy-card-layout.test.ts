import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const academyPage = readFileSync(
  join(process.cwd(), "app/jeu/centre-de-formation/page.tsx"),
  "utf8",
);

describe("agencement compact des juniors", () => {
  it("repartit les rubriques sur toute la largeur de la carte", () => {
    expect(academyPage).toContain("data-academy-rider-card");
    expect(academyPage).toContain(
      'className="grid gap-3 p-4 xl:grid-cols-2 2xl:grid-cols-4"',
    );
    expect(academyPage).toContain(
      "2xl:col-span-2",
    );
    expect(academyPage).toContain(
      "xl:col-span-2 2xl:col-span-4",
    );
    expect(academyPage).not.toContain(
      "xl:grid-cols-[minmax(250px,0.72fr)_minmax(0,1.35fr)_minmax(260px,0.75fr)]",
    );
  });

  it("reduit la hauteur des informations principales", () => {
    expect(academyPage).toContain('className="h-16 w-16"');
    expect(academyPage).toContain(
      'className="grid gap-3 sm:grid-cols-2"',
    );
    expect(academyPage).toContain("data-academy-rider-footer");
  });

  it("nomme explicitement la saison de recrutement", () => {
    expect(academyPage).toContain(
      "Recruter pour la saison {gameYear + 1}",
    );
    expect(academyPage).not.toContain("Recruter pour {gameYear + 1}");
  });
});
