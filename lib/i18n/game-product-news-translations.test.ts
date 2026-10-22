import { describe, expect, it } from "vitest";
import { translateUiText } from "./ui-translations";
import reviewed from "./reviewed-fr-en.json";
import generated from "./generated-fr-en.json";

describe("game news and staff translations", () => {
  it.each([
    ["Équipe du jeu", "Game team"],
    ["Gérer les actualités", "Manage game news"],
    ["Actualités du jeu", "Game news"],
    ["Brouillon privé", "Private draft"],
    ["Importer une illustration", "Upload an illustration"],
    ["Choisir dans la galerie générique", "Choose from the generic gallery"],
    ["Publiée · modifications en brouillon", "Published · draft changes"],
    ["Brouillon enregistré. La version publiée reste inchangée.", "Draft saved. The published version is unchanged."],
    ["Actualité publiée sur l’accueil et dans le jeu.", "Post published on the homepage and in the game."],
    ["Mettre les nouveautés en pause", "Pause the latest updates"],
    ["Reprendre le défilement des nouveautés", "Resume scrolling updates"],
    ["Règles et conseils sans quitter votre partie", "Rules and advice without leaving your game"],
  ])("translates the interface label %s", (source, expected) => {
    expect(translateUiText(source)).toBe(expected);
    expect((reviewed as Record<string, string>)[source]).toBe(expected);
    expect((generated as Record<string, string>)[source]).toBe(expected);
  });

  it("preserves member names in role actions", () => {
    expect(translateUiText("Nommer Borji dans l’équipe")).toBe("Add Borji to the game team");
    expect(translateUiText("Retirer le rôle de Ujik")).toBe("Remove role from Ujik");
  });

  it("preserves the editor’s emoji shortcodes and plain-text safety instructions", () => {
    const copy = "Gras, listes, liens et emojis sont pris en charge. Les raccourcis comme :tada:, :warning: et :loudspeaker: fonctionnent aussi. Aucun code HTML n’est exécuté.";
    const translated = translateUiText(copy);
    expect(translated).toContain(":tada:");
    expect(translated).toContain(":warning:");
    expect(translated).toContain(":loudspeaker:");
    expect(translated).toContain("No HTML code is executed.");
  });
});
