import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { DUTCH_SPONSORS } from "./netherlands";

const windmill = DUTCH_SPONSORS.find(
  (sponsor) => sponsor.id === "windmill-foods"
);

function assetFilePath(imagePath: string): string {
  return path.join(process.cwd(), "public", imagePath.replace(/^\//, ""));
}

describe("WindMill Foods assets", () => {
  it("utilise les quatre visuels restaurés", () => {
    expect(windmill).toBeDefined();
    expect(windmill?.logoPath).toBe(
      "/images/sponsors/windmill-foods/logo-v2.webp"
    );
    expect(windmill?.jerseys.map((jersey) => jersey.imagePath)).toEqual([
      "/images/sponsors/windmill-foods/jersey-classic-v2.webp",
      "/images/sponsors/windmill-foods/jersey-modern-v2.webp",
      "/images/sponsors/windmill-foods/jersey-bold-v2.webp",
    ]);
  });

  it("garde un fond transparent et un tissu opaque au centre des maillots", async () => {
    for (const jersey of windmill?.jerseys ?? []) {
      const { data, info } = await sharp(assetFilePath(jersey.imagePath))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      expect([info.width, info.height]).toEqual([600, 750]);

      const alphaAt = (x: number, y: number) =>
        data[(y * info.width + x) * info.channels + 3];

      expect(alphaAt(0, 0)).toBe(0);
      expect(alphaAt(info.width - 1, info.height - 1)).toBe(0);

      for (const y of [150, 250, 350, 450, 550, 650]) {
        expect(alphaAt(300, y)).toBeGreaterThan(240);
      }
    }
  });

  it("fournit un logo lisible et détouré", async () => {
    const metadata = await sharp(assetFilePath(windmill!.logoPath)).metadata();

    expect([metadata.width, metadata.height]).toEqual([512, 512]);
    expect(metadata.hasAlpha).toBe(true);
  });
});
