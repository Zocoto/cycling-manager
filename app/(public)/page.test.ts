import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("page d’accueil publique", () => {
  it("retire le texte marketing et les deux boutons du héros", () => {
    expect(source).not.toContain("Construisez votre équipe, recrutez");
    expect(source).not.toContain("Nouvelle carrière");
    expect(source).not.toContain("Se connecter");
    expect(source).not.toContain("function FolderIcon");
  });

  it("met le Patch 3 en vedette au-dessus de quatre annonces historiques", () => {
    expect(source).toContain('title: "Le Patch 3 est déployé"');
    expect(source).toContain('dateTime: "2026-08-01"');
    expect(source).toContain('title: "Le Patch 2 est déployé"');
    expect(source).toContain(
      'title: "Le Patch 1 pose les premières fondations"',
    );
    expect(source).toContain('title: "MVP déployé, pré-alpha lancée"');
    expect(source).toContain('title: "Le Discord ouvre ses portes"');
    expect(source).toContain(
      "const [featuredNews, ...historicalNews] = productNews;",
    );
    expect(source).toContain("xl:grid-cols-4");
    expect(source.indexOf("{featuredNews.title}")).toBeLessThan(
      source.indexOf("historicalNews.map"),
    );
  });
});
