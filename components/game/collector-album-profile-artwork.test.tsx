import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ALBUM_PROFILES } from "@/lib/game/collector-album";
import { AlbumProfileArtwork } from "./collector-album-profile-artwork";

describe("album category poster drawings", () => {
  it.each(ALBUM_PROFILES)("renders a different full-page scene for $id", ({ id }) => {
    const html = renderToStaticMarkup(createElement(AlbumProfileArtwork, { profile: id }));
    expect(html).toContain('viewBox="0 0 1200 700"');
    expect(html).toContain(`data-album-profile="${id}"`);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).not.toContain('role="img"');
    expect(html).not.toMatch(/<(image|filter|animate|foreignObject)\b|https?:\/\//);
  });

  it("offers descriptive accessible illustrations when they are not decorative", () => {
    const html = renderToStaticMarkup(createElement(AlbumProfileArtwork, { profile: "cobbles", decorative: false, className: "poster" }));
    expect(html).toContain('role="img"');
    expect(html).toContain('class="poster"');
    expect(html).not.toContain("aria-hidden");
    const titleId = html.match(/<title id="([^"]+)"/)?.[1];
    expect(titleId).toBeTruthy();
    expect(html).toContain(`aria-labelledby="${titleId}"`);
    expect(html).toContain("secteur pavé, moulin");
  });

  it("scopes every printing pattern to its own instance", () => {
    const html = renderToStaticMarkup(createElement("div", null,
      createElement(AlbumProfileArtwork, { profile: "cobbles" }),
      createElement(AlbumProfileArtwork, { profile: "cobbles" }),
    ));
    const ids = [...html.matchAll(/<pattern id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    const references = [...html.matchAll(/url\(#([^\)]+)\)/g)].map((match) => match[1]);
    expect(references.every((reference) => ids.includes(reference))).toBe(true);
  });

  it("does not reuse the same scenery for different rider categories", () => {
    const drawings = ALBUM_PROFILES.map(({ id }) => renderToStaticMarkup(createElement(AlbumProfileArtwork, { profile: id }))
      .replace(/album-[^-]+-/g, "album-instance-")
      .replace(/data-album-profile="[^"]+"/, ""));
    expect(new Set(drawings).size).toBe(ALBUM_PROFILES.length);
  });
});
