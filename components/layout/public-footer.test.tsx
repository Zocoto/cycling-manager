import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PublicFooter } from "./public-footer";

describe("PublicFooter", () => {
  it("affiche la version courante et son canal de publication", () => {
    const markup = renderToStaticMarkup(<PublicFooter />);

    expect(markup).toContain("Version 0.8.0 · Bêta");
  });

  it("affiche les accès Discord et Instagram avec leurs logos", () => {
    const markup = renderToStaticMarkup(<PublicFooter />);

    expect(markup).toContain("https://discord.gg/Zq9ecPYEF");
    expect(markup).toContain("https://www.instagram.com/cyclostratege/");
    expect(markup).toContain("/images/social/discord-symbol.svg");
    expect(markup).toContain("/images/social/instagram-glyph.svg");
    expect(markup.match(/target="_blank"/g)).toHaveLength(2);
    expect(markup.match(/rel="noreferrer"/g)).toHaveLength(2);
  });

  it("rend les documents légaux accessibles sur toutes les pages publiques", () => {
    const markup = renderToStaticMarkup(<PublicFooter />);

    expect(markup).toContain('href="/conditions-utilisation"');
    expect(markup).toContain('href="/confidentialite"');
    expect(markup).toContain('href="/mentions-legales"');
  });
});
