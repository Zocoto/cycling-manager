import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SEASON_FIVE_ALBUM_PAGES } from "@/lib/game/cyclo-stickers-s5-preparation";
import { CollectorAlbumCover } from "./collector-album-cover";
import { CycloStickersSeasonFivePreparation } from "./cyclo-stickers-season-five-preparation";

describe("private S5 album artwork and empty book", () => {
  it("labels source S5, future collection S6 and an empty editorial mockup", () => {
    const html = renderToStaticMarkup(<CycloStickersSeasonFivePreparation />);
    expect(html).toContain('data-source-season="5" data-collection-season="6"');
    expect(html).toContain("Maquette privée · S5 à collectionner en S6");
    expect(html).toContain("Les coureurs, les équipes et les champions seront renseignés à J28.");
    expect(html).toContain("CYCL’O QUIZZ · LA SAISON CUMBRE");
    expect(html).toContain("Maquette du sachet S5, sans carte ni booster disponible");
    expect(html).toContain("0 / 72 vignettes");
    expect(html).not.toContain("data-prepared-slot=");
    expect(html).not.toContain("Récompense");
  });

  it("renders every empty position once with an explicit page locator", () => {
    const renderedSlots: number[] = [];
    for (let index = 0; index < SEASON_FIVE_ALBUM_PAGES.length; index += 1) {
      const html = renderToStaticMarkup(<CycloStickersSeasonFivePreparation initialPage={index} />);
      renderedSlots.push(...[...html.matchAll(/data-prepared-slot="(\d+)"/g)].map(match => Number(match[1])));
      expect(html).toContain("Aller à une page");
      expect(html).toContain(`${index + 1} / ${SEASON_FIVE_ALBUM_PAGES.length}`);
      expect(html).toContain("Aucune carte créée. Aucun effet sur les collections des joueurs.");
      expect(html.match(/<option/g)).toHaveLength(SEASON_FIVE_ALBUM_PAGES.length);
      expect(html).not.toContain("Coller");
    }
    expect(renderedSlots).toEqual(Array.from({ length: 72 }, (_, index) => index + 1));
  });

  it("retains the released S4 Halloween/Games cover without the future S5 treatment", () => {
    const html = renderToStaticMarkup(<CollectorAlbumCover season={4} count={12} total={72} gamesEdition privatePreview={false} />);
    expect(html).toContain("HALLOWEEN · JEUX QUADRIENNAUX");
    expect(html).toContain("Une flamme dans la nuit.");
    expect(html).not.toContain("CUMBRE");
    expect(html).not.toContain("QUIZZ");
    expect(html).toContain("12 / 72 vignettes");
  });
});
