import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import raw from "@/data/collector-album-pilot.json";
import { ALBUM_PROFILES, type CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import * as reading from "@/lib/game/collector-album-reading";
import { CollectorAlbum } from "./collector-album";
import { CollectorAlbumCover } from "./collector-album-cover";
import retro from "./collector-album-retro.module.css";

const snapshot = raw as CollectorAlbumSnapshot;
const storageOwnerId = "private-book-ssr-test";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function buttonMarkup(html: string, text: string): string {
  const button = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].find(([tag]) => tag.replace(/<[^>]+>/g, "").includes(text));
  if (!button) throw new Error(`Missing button: ${text}`);
  return button[0];
}

function mediaBody(css: string, preference: "no-preference" | "reduce") {
  const start = new RegExp(`@media\\s*\\(\\s*prefers-reduced-motion\\s*:\\s*${preference}\\s*\\)\\s*\\{`).exec(css);
  if (!start) throw new Error(`Missing motion preference: ${preference}`);
  let depth = 1;
  const contentStart = start.index + start[0].length;
  let end = contentStart;
  for (; end < css.length && depth; end++) {
    if (css[end] === "{") depth++;
    if (css[end] === "}") depth--;
  }
  if (depth) throw new Error("Unbalanced CSS media block");
  return { body: css.slice(contentStart, end - 1), before: css.slice(0, start.index), after: css.slice(end) };
}

function declarationsFor(css: string, selector: string): string {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(",").some(value => value.trim() === selector))
    .map(([, , declarations]) => declarations).join(";");
}

describe("the private album as a book", () => {
  it("starts with only the closed cover when no chapter was explicitly requested", () => {
    const implicit = renderToStaticMarkup(<CollectorAlbum snapshot={snapshot} storageOwnerId={storageOwnerId}/>);
    const explicitUndefined = renderToStaticMarkup(<CollectorAlbum snapshot={snapshot} storageOwnerId={storageOwnerId} initialProfile={undefined}/>);
    expect(implicit).toBe(explicitUndefined);
    expect(implicit.match(/data-album-cover=""/g)).toHaveLength(1);
    expect(implicit).toContain('aria-label="Couverture de l’album"');
    expect(implicit).not.toContain("data-profile=");
    expect(implicit).not.toContain("data-album-slot=");
    expect(implicit).not.toContain("data-album-leaf=");
    expect(implicit).not.toContain('aria-label="Profils de coureurs"');
    expect(buttonMarkup(implicit, "Ouvrir mon album")).toContain('disabled=""');
  });

  it.each(ALBUM_PROFILES)("opens an explicit $id chapter directly, retaining every category card", ({ id }) => {
    const html = renderToStaticMarkup(<CollectorAlbum snapshot={snapshot} storageOwnerId={storageOwnerId} initialProfile={id}/>);
    expect(html).not.toContain("data-album-cover=");
    expect(html).toContain(`data-profile="${id}"`);
    expect(html).toContain("Refermer l’album");
    expect(html.match(/data-album-leaf="[12]"/g)).toHaveLength(2);
    const displayed = [...html.matchAll(/data-album-slot="(\d+)"/g)].map(([, number]) => Number(number));
    expect(displayed).toEqual(snapshot.cards.filter(card => card.profileKey === id).map(card => card.number));
  });

  it.each([
    ["boosters", "LE KIOSQUE DU COLLECTIONNEUR"],
    ["trades", "LE COIN DES COLLECTIONNEURS"],
    ["achievements", "LE LIVRE D’OR"],
  ] as const)("lets the %s deep link reach its desk without opening the cover", (initialTab, heading) => {
    const html = renderToStaticMarkup(<CollectorAlbum snapshot={snapshot} storageOwnerId={storageOwnerId} initialTab={initialTab}/>);
    expect(html).toContain(heading);
    expect(html).not.toContain("data-album-cover=");
    expect(html).not.toContain("data-album-slot=");
    expect(html).not.toContain("Ouvrir mon album");
  });

  it.each(["album", "boosters", "trades", "achievements"] as const)("keeps one main heading and removes the old panoramic hero in %s", initialTab => {
    const html = renderToStaticMarkup(<CollectorAlbum snapshot={snapshot} storageOwnerId={storageOwnerId} initialTab={initialTab}/>);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain("<h1>Album de Cyclo-Stickers</h1>");
    expect(html).not.toContain(retro.coverMasthead);
    expect(html).not.toContain(retro.coverDetails);
    expect(html).not.toContain("Échappées, cols et belles histoires");
  });

  it("prints a resume bookmark and disables both cover actions until hydration is ready", () => {
    const onOpen = vi.fn();
    const onStart = vi.fn();
    const html = renderToStaticMarkup(<CollectorAlbumCover season={3} count={17} total={50} resumeLabel="Puncheurs" ready={false} onOpen={onOpen} onStart={onStart}/>);
    expect(html).toContain("Marque-page · Puncheurs");
    expect(html).toContain("<strong>S3</strong>");
    expect(html).toContain("17 / 50 vignettes");
    expect(html).not.toContain("Ouvrir mon album");
    expect(buttonMarkup(html, "Reprendre mon album")).toContain('disabled=""');
    expect(buttonMarkup(html, "Revenir à la première page")).toContain('disabled=""');
    expect(onOpen).not.toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("only enables the resume actions after readiness and keeps decorative opening covers inert", () => {
    const html = renderToStaticMarkup(<CollectorAlbumCover season={3} count={17} total={50} resumeLabel="Rouleurs" ready/>);
    expect(buttonMarkup(html, "Reprendre mon album")).not.toContain("disabled");
    expect(buttonMarkup(html, "Revenir à la première page")).not.toContain("disabled");
    const decorative = renderToStaticMarkup(<CollectorAlbumCover season={3} count={17} total={50} decorative/>);
    expect(decorative).toMatch(/data-album-cover="" aria-hidden="true"/);
    expect(decorative).not.toContain("<button");
    expect(decorative).not.toContain("<h1");
  });

  it("does not read browser preferences, storage, schedule frames or fetch while server rendering", () => {
    const forbidden = vi.fn(() => { throw new Error("SSR must not touch browser state or the network"); });
    const browser = Object.defineProperty({}, "localStorage", { get: forbidden });
    vi.stubGlobal("window", browser);
    vi.stubGlobal("localStorage", { getItem: forbidden, setItem: forbidden });
    vi.stubGlobal("fetch", forbidden);
    vi.stubGlobal("requestAnimationFrame", forbidden);
    const readPreferences = vi.spyOn(reading, "readAlbumReadingState");
    const html = renderToStaticMarkup(<CollectorAlbum snapshot={snapshot} storageOwnerId={storageOwnerId}/>);
    expect(html).toContain("Ouverture de ton album…");
    expect(html).not.toContain("Reprendre mon album");
    expect(forbidden).not.toHaveBeenCalled();
    expect(readPreferences).not.toHaveBeenCalled();
  });
});

describe("book motion preferences", () => {
  const css = readFileSync(path.join(process.cwd(), "components/game/collector-album-book.module.css"), "utf8");

  it("only animates the cover, page turn and collage when motion is allowed", () => {
    const normal = mediaBody(css, "no-preference");
    for (const selector of [".openingCover", ".pageTurn", ".pageContent", ".pasted"]) {
      expect(declarationsFor(normal.body, selector)).toMatch(/\banimation\s*:/);
    }
    expect(`${normal.before}${normal.after}`).not.toMatch(/\banimation(?:-name)?\s*:/);
  });

  it("hides the decorative cover and turning leaf entirely when reduced motion is requested", () => {
    const reduced = mediaBody(css, "reduce").body;
    for (const selector of [".openingCover", ".pageTurn"]) {
      expect(declarationsFor(reduced, selector)).toMatch(/\bdisplay\s*:\s*none\b/);
      expect(declarationsFor(css.slice(0, css.indexOf("@media")), selector)).toMatch(/\bpointer-events\s*:\s*none\b/);
    }
  });
});
