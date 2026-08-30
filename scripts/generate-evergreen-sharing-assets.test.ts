import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const generatorSource = readFileSync(
  path.join(projectRoot, "scripts", "generate-evergreen-sharing-assets.mjs"),
  "utf8",
);
const seasonGeneratorSource = readFileSync(
  path.join(projectRoot, "scripts", "generate-season2-marketing-assets.mjs"),
  "utf8",
);
const openGraphAlt = readFileSync(
  path.join(projectRoot, "app", "opengraph-image.alt.txt"),
  "utf8",
);

describe("aperçus permanents des liens", () => {
  it("part d’un visuel composé avec de vraies captures du jeu", () => {
    expect(generatorSource).toContain("webgame-nexus-cover.webp");
    expect(generatorSource).toContain(".resize(1200, 630");
    expect(generatorSource).toContain('"opengraph-image.png"');
    expect(generatorSource).toContain('"twitter-image.png"');
  });

  it("ne peut plus être écrasé par la campagne Saison 2", () => {
    expect(seasonGeneratorSource).not.toContain('"opengraph-image.png"');
    expect(seasonGeneratorSource).not.toContain('"twitter-image.png"');
  });

  it("emploie un texte alternatif sans saison, patch ni bêta", () => {
    expect(openGraphAlt).toContain("jeu de management d’équipe cycliste");
    expect(openGraphAlt).not.toMatch(/saison|patch|bêta/i);
  });
});
