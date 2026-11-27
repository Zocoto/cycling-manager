import { describe, expect, it } from "vitest";
import { translateUiText } from "./ui-translations";

describe("Christmas experience English labels", () => {
  it.each([
    ["Le Noël du Peloton", "Christmas in the Peloton"],
    ["Calendrier de l’Avent", "Advent calendar"],
    ["Boutique des Grelots", "Jingle Bell shop"],
    ["12 Grelots", "12 Jingle Bells"],
    ["3 sur 24 ouvertes", "3 of 24 opened"],
    ["Lâcher un cadeau", "Drop a gift"],
    ["Traîneau en mouvement", "Sleigh moving"],
    ["Lancer bloqué · 1,2 s", "Throw blocked · 1,2 s"],
    ["9/14 cadeaux livrés · 2400 points", "9/14 gifts delivered · 2400 points"],
    ["3 lunettes disponibles · coche l’option avant de décoller. Une lunette sera utilisée au départ.", "3 scopes available · tick the option before take-off. One scope will be used at the start."],
    ["70 lumières avant le prochain palier", "70 lights until the next milestone"],
    ["24 décembre · À ouvrir", "24 December · Ready to open"],
    ["Bonnet de la nuit étoilée", "Starry night hat"],
    ["Hotte à double fond", "Double-bottom gift sack"],
    ["Cuissard Quatre Saisons", "Four Seasons bib shorts"],
  ])("translates %s without changing the event values", (source, expected) => {
    expect(translateUiText(source)).toBe(expected);
  });
  it("keeps actual rider names untouched in reward notices", () => {
    expect(translateUiText("Preecha Ngo rejoint ton inventaire.")).toBe("Preecha Ngo has been added to your inventory.");
  });
});
