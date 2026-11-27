import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CycloStickersLibraryEntry } from "@/lib/game/cyclo-stickers-library";
import { CycloStickersLibrary, CycloStickersLibraryNavigation } from "./cyclo-stickers-library";

const s4: CycloStickersLibraryEntry = { editionId: "collection-s4", sourceSeasonId: "s4", collectionSeasonId: "s5",
  sourceSeason: 4, collectionSeason: 5, totalCards: 72, pastedCount: 18, ownedCount: 30, completionPercent: 25 };
const s5: CycloStickersLibraryEntry = { ...s4, editionId: "collection-s5", sourceSeason: 5, collectionSeason: 6,
  sourceSeasonId: "s5", collectionSeasonId: "s6", pastedCount: 72, ownedCount: 110, completionPercent: 100 };

describe("published album shelf", () => {
  it("shows source seasons and their own completion on navigable book spines", () => {
    const html = renderToStaticMarkup(<CycloStickersLibrary editions={[s5, s4]} />);
    expect(html).toContain("Ta bibliothèque de Cyclo-Stickers");
    expect(html).toContain('href="/jeu/album?edition=collection-s4"');
    expect(html).toContain('href="/jeu/album?edition=collection-s5"');
    expect(html).toContain("18 / 72");
    expect(html).toContain("72 / 72");
    expect(html).toContain("25<small>%</small>");
    expect(html).toContain("100<small>%</small>");
    expect(html.indexOf('data-source-season="4"')).toBeLessThan(html.indexOf('data-source-season="5"'));
    expect(html).not.toContain("SAISON <strong>6</strong>");
    expect(html).not.toContain("preparation-s5");
  });

  it("labels the owner's uncreated S5 mockup separately and keeps it outside collection totals", () => {
    const html = renderToStaticMarkup(<CycloStickersLibrary editions={[s4]} ownerPreview />);
    expect(html).toContain('href="/jeu/album/preparation-s5"');
    expect(html).toContain("Maquette privée");
    expect(html).toContain("Cartes à préparer à J28");
    expect(html).toContain("18 / 72 vignettes collées");
    expect(html).not.toContain("18 / 144");
    expect(html).toContain("Prototype privé S3");
    expect(renderToStaticMarkup(<CycloStickersLibrary editions={[s4, s5]} ownerPreview />)).not.toContain("preparation-s5");
  });

  it("provides an edition-safe switcher and a direct return to the bookshelf", () => {
    const html = renderToStaticMarkup(<CycloStickersLibraryNavigation editions={[s5, s4]} selectedEditionId={s4.editionId} />);
    expect(html).toContain('href="/jeu/album"');
    expect(html).toContain("Ma bibliothèque");
    expect(html).toContain('action="/jeu/album"');
    expect(html).toContain('name="edition"');
    expect(html).toContain('value="collection-s4" selected=""');
    expect(html).toContain("Album S4");
    expect(html).toContain("Album S5");
    expect(html).not.toContain("Album S6");
  });

  it("links unopened packs on their exact older edition without inventing packs on other books", () => {
    const html = renderToStaticMarkup(<CycloStickersLibrary editions={[s5, { ...s4, unopenedBoosterCount: 3 }]} />);
    expect(html).toContain("Sachets à ouvrir : 3");
    expect(html).toContain('href="/jeu/album?edition=collection-s4&amp;onglet=boosters"');
    expect(html).not.toContain('href="/jeu/album?edition=collection-s5&amp;onglet=boosters"');
    expect(html.match(/Sachets à ouvrir/g)).toHaveLength(1);
    expect(renderToStaticMarkup(<CycloStickersLibrary editions={[{ ...s4, unopenedBoosterCount: 0 }]} />)).not.toContain("Sachets à ouvrir");
  });
});
