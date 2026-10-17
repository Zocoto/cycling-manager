import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { NationalJerseyDesignArtwork } from "./national-jersey-design-artwork";
import { NATIONAL_JERSEY_ELEMENT_SHAPES, normalizeNationalJerseyDraft, type NationalJerseyElement } from "@/lib/game/national-jersey-preview";

function artwork(patch: Partial<NationalJerseyElement>) {
  const design = normalizeNationalJerseyDraft({ baseColor: "#FFFFFF", elements: [{ id: "test", kind: "flag", shape: "rectangle", color: "#123456", secondaryColor: "#FF00FF", x: 60, y: 66, width: 40, height: 30, rotation: 0, opacity: 1, ...patch }] });
  const flag = readFileSync(path.join(process.cwd(), "public/images/flags/4x3/fr.svg")).toString("base64");
  return renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width="120" height="132" viewBox="0 0 120 132"><NationalJerseyDesignArtwork countryCode="FR" design={design} idPrefix="test" /></svg>)
    .replaceAll('href="/images/flags/4x3/fr.svg"', `href="data:image/svg+xml;base64,${flag}"`);
}

describe("contours et motifs du maillot", () => {
  it("garde exactement le rendu d’un ancien drapeau sans option de contour", () => {
    expect(artwork({})).toBe(artwork({ border: true }));
  });
  it("retire réellement les pixels du cadre sans retirer le drapeau", async () => {
    const pixel = async (border: boolean) => {
      const { data, info } = await sharp(Buffer.from(artwork({ border }))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const offset = (66 * info.width + 40) * info.channels;
      return Array.from(data.subarray(offset, offset + 3));
    };
    expect(await pixel(true)).toEqual([255, 0, 255]);
    expect(await pixel(false)).not.toEqual([255, 0, 255]);
    expect(artwork({ border: false })).toContain("data-national-champion-flag");
  });
  it.each(NATIONAL_JERSEY_ELEMENT_SHAPES)("dessine la forme %s sans produire un calque vide", async shape => {
    const svg = artwork({ kind: "shape", shape, border: false });
    const stats = await sharp(Buffer.from(svg)).stats();
    expect(stats.channels[0].min).toBeLessThan(250);
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
});
