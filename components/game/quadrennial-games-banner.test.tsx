import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuadrennialGamesBanner } from "./quadrennial-games-banner";

describe("quadrennial Games prominence", () => {
  it("uses five colours and a dedicated major-event headline", () => {
    const html = renderToStaticMarkup(<QuadrennialGamesBanner seasonName="Saison 4" />);
    for (const color of ["#0085C7", "#F4C300", "#20232B", "#009F6B", "#DF0024"]) expect(html).toContain(color);
    expect(html).toContain("<h1");
    expect(html).toContain("Jeux quadriennaux");
    expect(html).toContain("220 coureurs");
    expect(html).not.toContain("<a");
  });
  it("offers one direct dashboard link without another main heading", () => {
    const html = renderToStaticMarkup(<QuadrennialGamesBanner compact seasonName="Saison 8" />);
    expect(html).toContain('href="/jeu/nations-cup"');
    expect(html).toContain("<h2");
    expect(html).not.toContain("<h1");
    expect(html).toContain("Saison 8");
  });
});
