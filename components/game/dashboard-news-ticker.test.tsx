import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { DashboardNewsTicker } from "./dashboard-news-ticker";

const hookState = vi.hoisted(() => ({ paused: false }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: () => [hookState.paused, vi.fn()] };
});
vi.mock("@/components/ui/app-link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));

const items = [{ id: "news-one", title: "Une nouvelle fonctionnalité" }, { id: "news-two", title: "Un événement dans le peloton" }];

beforeEach(() => { hookState.paused = false; });

describe("DashboardNewsTicker", () => {
  it("links only inside the connected game and keeps a slim single-height layout", () => {
    const html = renderToStaticMarkup(<DashboardNewsTicker items={items} />);
    expect(html).toContain('href="/jeu/nouveautes"');
    expect(html).toContain('href="/jeu/nouveautes/news-one"');
    expect(html).toContain('href="/jeu/nouveautes/news-two"');
    expect(html).not.toContain('href="/nouveautes');
    expect(html).not.toContain("/deconnexion");
    expect(html).toContain("h-10");
    expect(html).toContain('aria-label="Dernières nouveautés"');
  });
  it("keeps looping copies clickable without adding duplicate keyboard stops", () => {
    const html = renderToStaticMarkup(<DashboardNewsTicker items={items} />);
    expect(html).toContain('aria-label="Mettre les nouveautés en pause"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('data-paused="false"');
    expect(html).toContain('aria-hidden="true" class="flex items-center gap-8"');
    expect(html.match(/href="\/jeu\/nouveautes\/news-one"/g)).toHaveLength(2);
    expect(html.match(/href="\/jeu\/nouveautes\/news-two"/g)).toHaveLength(2);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
  });
  it("renders an explicit resume state after pausing", () => {
    hookState.paused = true;
    const html = renderToStaticMarkup(<DashboardNewsTicker items={items} />);
    expect(html).toContain('aria-label="Reprendre le défilement des nouveautés"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-paused="true"');
  });
  it("pauses while hovered or focused and disables animation for reduced motion", () => {
    const html = renderToStaticMarkup(<DashboardNewsTicker items={items} />);
    expect(html).toContain(":hover .game-news-ticker-track");
    expect(html).toContain(":focus-within .game-news-ticker-track");
    expect(html).toContain("[data-paused=true]");
    expect(html).toContain("animation-play-state:paused");
    expect(html).toContain("prefers-reduced-motion:reduce");
    expect(html).toContain("animation:none");
  });
  it("does not animate or display an unnecessary pause button for zero or one update", () => {
    const empty = renderToStaticMarkup(<DashboardNewsTicker items={[]} />);
    expect(empty).toContain("Les actualités du jeu");
    expect(empty).not.toContain('aria-label="Mettre les nouveautés en pause"');
    const single = renderToStaticMarkup(<DashboardNewsTicker items={[items[0]]} />);
    expect(single).not.toContain('aria-label="Mettre les nouveautés en pause"');
    expect(single).not.toMatch(/class="game-news-ticker-track[^"]*game-news-ticker-animated/);
  });
  it("escapes announcement titles and has no polling, background requests or realtime subscription", () => {
    const html = renderToStaticMarkup(<DashboardNewsTicker items={[{ id: "safe-id", title: "<script>unsafe()</script>" }]} />);
    expect(html).not.toContain("<script>unsafe");
    expect(html).toContain("&lt;script&gt;");
    const source = readFileSync(new URL("./dashboard-news-ticker.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/useEffect|setInterval|fetch\(|WebSocket|\.channel\(|\.subscribe\(/);
  });
});
