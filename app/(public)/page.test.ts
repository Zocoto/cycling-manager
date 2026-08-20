import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("page d’accueil publique", () => {
  it("présente le jeu de cyclisme en ligne dès le haut du héros", () => {
    const labelIndex = source.indexOf("jeu de cyclisme en ligne");
    const titleIndex = source.indexOf("Prenez la tête");

    expect(labelIndex).toBeGreaterThan(-1);
    expect(labelIndex).toBeLessThan(titleIndex);
    expect(source).toContain("Online cycling game");
  });

  it("retire le texte marketing et les deux boutons du héros", () => {
    expect(source).not.toContain("Construisez votre équipe, recrutez");
    expect(source).not.toContain("Nouvelle carrière");
    expect(source).not.toContain("Se connecter");
    expect(source).not.toContain("function FolderIcon");
  });

  it("met la Saison 2 en vedette au-dessus de quatre annonces historiques", () => {
    expect(source).toContain('title: "La saison 2 ouvre le bêta test"');
    expect(source).toContain('dateTime: "2026-08-16"');
    expect(source).toContain(
      'title: "Le Patch 4 d\\u00e9veloppe vos infrastructures"',
    );
    expect(source).toContain('title: "Le Patch 3 est déployé"');
    expect(source).toContain('dateTime: "2026-08-01"');
    expect(source).toContain('title: "Le Patch 2 est déployé"');
    expect(source).toContain(
      'title: "Le Patch 1 pose les premières fondations"',
    );
    expect(source).toContain('title: "MVP déployé, pré-alpha lancée"');
    expect(source).toContain('title: "Le Discord ouvre ses portes"');
    expect(source).toContain(
      "const [featuredNews, ...historicalNews] = isEnglish",
    );
    expect(source).toContain("? productNewsEn");
    expect(source).toContain(": productNews;");
    expect(source).toContain("xl:grid-cols-4");
    expect(source.indexOf("{featuredNews.title}")).toBeLessThan(
      source.indexOf("historicalNews.slice"),
    );
  });
  it("publie la Saison 2 et renvoie directement vers l’inscription", () => {
    expect(source).not.toContain("/beta-saison-2");
    expect(source).toContain('href: "/inscription"');
    expect(source).toContain('linkLabel: "Rejoindre la saison 2"');
    expect(source).toContain(
      'image: "/images/marketing/season-2-beta-editorial.png"',
    );
    expect(source).toContain("src={featuredNews.image}");
    expect(source).toContain("historicalNews.slice(0, 4)");
  });
});
