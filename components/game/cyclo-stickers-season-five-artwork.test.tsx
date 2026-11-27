import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CycloStickersSeasonFiveArtwork } from "./cyclo-stickers-season-five-artwork";

describe("S5 editorial illustration", () => {
  it("shows the selected Cumbre kit, the real quiz host and each of the three GT wins", () => {
    const html = renderToStaticMarkup(<CycloStickersSeasonFiveArtwork />);
    expect(html).toContain('data-sponsor-jersey="cumbre-coca-rush-bold"');
    expect(html).toContain('data-quiz-host="quizz-o-stratege"');
    expect(html).toContain("3 GRANDS TOURS · 3 VICTOIRES");
    expect([...html.matchAll(/data-grand-tour="([^"]+)"/g)].map(match => match[1]))
      .toEqual(["corsa-delle-regioni", "boucle-des-provinces", "ruta-de-las-sierras"]);
    expect(html).not.toContain("<image");
  });

  it("keeps every SVG reference unique and resolved when cover and sachet share a page", () => {
    const html = renderToStaticMarkup(<><CycloStickersSeasonFiveArtwork /><CycloStickersSeasonFiveArtwork /></>);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [, reference] of html.matchAll(/url\(#([^)]*)\)/g)) expect(ids).toContain(reference);
  });
});
