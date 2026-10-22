import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { EMPTY_GAME_NEWS_DOCUMENT, type PublishedGameNews } from "@/lib/game/game-product-news";
import { DashboardNewsTickerLoader } from "./dashboard-news-ticker-loader";

const dependencies = vi.hoisted(() => ({ news: vi.fn(), locale: vi.fn() }));
vi.mock("@/services/game-product-news", () => ({ getPublishedGameNews: dependencies.news }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: dependencies.locale }));
vi.mock("@/components/ui/app-link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));

function createNews(index: number): PublishedGameNews {
  return { id: `news-${index}`, revision: 1, publishedAt: "2026-10-22T08:00:00Z", updatedAt: "2026-10-22T08:00:00Z", document: { ...EMPTY_GAME_NEWS_DOCUMENT, title: `Actualité française ${index}`, title_en: `English update ${index}` } };
}

beforeEach(() => {
  vi.resetAllMocks();
  dependencies.news.mockResolvedValue(Array.from({ length: 8 }, (_, index) => createNews(index)));
  dependencies.locale.mockResolvedValue("fr");
});

describe("DashboardNewsTickerLoader", () => {
  it("loads one compact batch and caps the dashboard to the five latest updates", async () => {
    const html = renderToStaticMarkup(await DashboardNewsTickerLoader());
    expect(dependencies.news).toHaveBeenCalledTimes(1);
    expect(dependencies.locale).toHaveBeenCalledTimes(1);
    expect(html).toContain('href="/jeu/nouveautes/news-0"');
    expect(html).toContain('href="/jeu/nouveautes/news-4"');
    expect(html).not.toContain('href="/jeu/nouveautes/news-5"');
    expect(html).toContain("Actualité française 0");
  });
  it("localizes using the active game language", async () => {
    dependencies.locale.mockResolvedValue("en");
    const html = renderToStaticMarkup(await DashboardNewsTickerLoader());
    expect(html).toContain("English update 0");
    expect(html).not.toContain("Actualité française 0");
  });
  it.each(["news", "locale"] as const)("keeps a harmless fallback when %s loading fails", async (source) => {
    dependencies[source].mockRejectedValue(new Error("Unavailable"));
    const html = renderToStaticMarkup(await DashboardNewsTickerLoader());
    expect(html).toContain("Les actualités du jeu");
    expect(html).toContain('href="/jeu/nouveautes"');
    expect(html).not.toContain("Unavailable");
    expect(html).not.toContain('aria-label="Mettre les nouveautés en pause"');
  });
  it("renders the fallback when there are no published updates", async () => {
    dependencies.news.mockResolvedValue([]);
    expect(renderToStaticMarkup(await DashboardNewsTickerLoader())).toContain("Les actualités du jeu");
  });
  it("does not issue an HTTP round trip or any mutation to populate the dashboard", () => {
    const source = readFileSync(new URL("./dashboard-news-ticker-loader.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/fetch\(|http[s]?:\/\/|\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
    expect(source).toContain("news.slice(0, 5)");
  });
});
