import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { EMPTY_GAME_NEWS_DOCUMENT, type PublishedGameNews } from "@/lib/game/game-product-news";
import { GameNewsCards, GameNewsPublication, formatGameNewsDate } from "./game-news-publication";

vi.mock("@/components/ui/app-link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("next/image", () => ({ default: (props: { src: string; alt: string }) => <span role="img" aria-label={props.alt} data-news-image-src={props.src} /> }));

const article: PublishedGameNews = {
  id: "news-one", revision: 2, publishedAt: "2026-10-21T22:30:00Z", updatedAt: "2026-10-22T08:00:00Z",
  document: { ...EMPTY_GAME_NEWS_DOCUMENT, title: "Les nouveautés du peloton", category: "Mise à jour", summary: "Une nouvelle rubrique pour garder le fil.", body: "Les **nouveautés** :tada: et [le guide](/guide#equipe).", link_url: "/nouveautes/news-two", link_label: "Voir la suite" },
};

describe("GameNewsCards", () => {
  it("keeps public cards public and in-game cards inside the connected shell", () => {
    expect(renderToStaticMarkup(<GameNewsCards articles={[article]} />)).toContain('href="/nouveautes/news-one"');
    const html = renderToStaticMarkup(<GameNewsCards articles={[article]} connected />);
    expect(html).toContain('href="/jeu/nouveautes/news-one"');
    expect(html).toContain("Lire l’actualité");
    expect(html).not.toContain("target=");
    expect(html).not.toContain("/deconnexion");
  });
  it("uses available English copy and falls back field by field to French", () => {
    const html = renderToStaticMarkup(<GameNewsCards articles={[{ ...article, document: { ...article.document, title_en: "Latest peloton news" } }]} locale="en" connected />);
    expect(html).toContain("Latest peloton news");
    expect(html).toContain(article.document.summary);
    expect(html).toContain("Read the update");
  });
});

describe("GameNewsPublication", () => {
  it("renders the published document and connected body/destination links", () => {
    const html = renderToStaticMarkup(<GameNewsPublication article={article} connected />);
    expect(html).toContain(article.document.title);
    expect(html).toContain('href="/jeu/guide#equipe"');
    expect(html).toContain('href="/jeu/nouveautes/news-two"');
    expect(html).toContain("🎉");
    expect(html).toContain("Mis à jour");
    expect(html).toContain("22 octobre 2026");
  });
  it("does not render unsafe destination links or executable title content", () => {
    const html = renderToStaticMarkup(<GameNewsPublication article={{ ...article, document: { ...article.document, title: "<script>unsafe()</script>", summary: '<img src="x" onerror="unsafe()">', body: "Du texte sans lien.", link_url: "javascript:alert(1)" } }} connected />);
    expect(html).not.toContain("<script>unsafe");
    expect(html).not.toContain('<img src="x"');
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<a ");
    expect(html).toContain("&lt;script&gt;");
  });
  it("gives a safe external destination a separate tab with isolation", () => {
    const html = renderToStaticMarkup(<GameNewsPublication article={{ ...article, document: { ...article.document, link_url: "https://example.org/news" } }} connected />);
    expect(html).toContain('href="https://example.org/news"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it("omits the update indicator when the publication has never been modified", () => {
    const html = renderToStaticMarkup(<GameNewsPublication article={{ ...article, updatedAt: article.publishedAt }} />);
    expect(html).not.toContain("Mis à jour");
  });
  it("keeps the selected illustration and its accessible description", () => {
    const html = renderToStaticMarkup(<GameNewsPublication article={{ ...article, document: { ...article.document, image_path: "/images/peloton-header.webp", image_alt: "Le peloton en course" } }} />);
    expect(html).toContain('data-news-image-src="/images/peloton-header.webp"');
    expect(html).toContain('aria-label="Le peloton en course"');
  });
});

describe("formatGameNewsDate", () => {
  it("uses the Paris calendar date even when the timestamp is still the previous UTC day", () => {
    expect(formatGameNewsDate("2026-10-21T22:30:00Z", "fr")).toBe("22 octobre 2026");
    expect(formatGameNewsDate("2026-10-21T22:30:00Z", "en")).toBe("22 October 2026");
  });
});
