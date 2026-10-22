import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameNewsBody, gameNewsContextHref } from "./game-news-body";

const render = (body: string, connected = false) => renderToStaticMarkup(<GameNewsBody body={body} connected={connected} />);

describe("GameNewsBody", () => {
  it("renders the supported Markdown subset and communication emojis", () => {
    const html = render("## Les nouveautés :tada:\n\nUn **vrai changement** et une *information utile*.\nUne seconde ligne.\n\n- Une correction :white_check_mark:\n- Un avertissement :warning:");
    expect(html).toContain("<h2");
    expect(html).toContain("Les nouveautés 🎉");
    expect(html).toContain('>vrai changement</strong>');
    expect(html).toContain("<em>information utile</em>");
    expect(html).toContain("<br/>Une seconde ligne.");
    expect(html).toContain("<ul");
    expect(html).toContain("Une correction ✅</li>");
    expect(html).toContain("Un avertissement ⚠️</li>");
  });

  it("escapes raw HTML, script tags, image tags and event handlers", () => {
    const html = render('<script>alert("XSS")</script>\n\n<img src=x onerror=alert(1)>\n\n<iframe src="https://example.org"></iframe>');
    expect(html).not.toMatch(/<script|<img|<iframe|<[^>]+ onerror=/);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;iframe");
  });

  it.each([
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,script", "vbscript:message", "//evil.example.org", "/%2fevil.example.org", "/\\evil.example.org", "http://example.org",
  ])("never activates an unsafe Markdown URL: %s", (url) => {
    const html = render(`[Cliquer](${url})`);
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href=");
  });

  it("keeps external HTTPS links isolated with noopener and noreferrer", () => {
    const html = render("[Communauté](https://example.org/club?x=1&y=2)");
    expect(html).toContain('href="https://example.org/club?x=1&amp;y=2"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("routes guide and news links inside the connected game without a new tab", () => {
    const html = render("[Guide](/guide#staff) et [Actualité](/nouveautes/article-1?origine=news)", true);
    expect(html).toContain('href="/jeu/guide#staff"');
    expect(html).toContain('href="/jeu/nouveautes/article-1?origine=news"');
    expect(html).not.toContain('target="_blank"');
    expect(html).not.toContain("/deconnexion");
  });

  it("does not reinterpret raw Markdown images as actual image elements", () => {
    const html = render("![Image](https://example.org/image.png)");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
  });
});

describe("gameNewsContextHref", () => {
  it.each([
    ["/guide", "/jeu/guide"],
    ["/guide/", "/jeu/guide/"],
    ["/guide/#staff", "/jeu/guide/#staff"],
    ["/guide?rubrique=staff#finances", "/jeu/guide?rubrique=staff#finances"],
    ["/nouveautes", "/jeu/nouveautes"],
    ["/nouveautes/news-1#suite", "/jeu/nouveautes/news-1#suite"],
    ["/jeu/guide", "/jeu/guide"],
    ["/jeu/nouveautes/news-1", "/jeu/nouveautes/news-1"],
    ["/guide-inexistant", "/guide-inexistant"],
    ["/nouveautes-personnelles", "/nouveautes-personnelles"],
    ["https://example.org/guide", "https://example.org/guide"],
    ["https://cyclostratege.fr/guide?onglet=staff#finances", "/jeu/guide?onglet=staff#finances"],
    ["https://www.cyclostratege.fr/nouveautes/news-1", "/jeu/nouveautes/news-1"],
    ["https://cyclostratege.fr.evil.example/guide", "https://cyclostratege.fr.evil.example/guide"],
  ])("maps only exact connected paths: %s", (input, expected) => {
    expect(gameNewsContextHref(input, true)).toBe(expected);
    expect(gameNewsContextHref(input, false)).toBe(input);
  });
});
