import { stat } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  AIRLINE_SPONSORS,
  TOURISM_SPONSORS,
} from "./tourism-airlines";

const sponsors = [
  ...TOURISM_SPONSORS,
  ...AIRLINE_SPONSORS,
];

describe("sponsors tourisme et compagnies aériennes", () => {
  it("ajoute dix destinations et dix compagnies", () => {
    expect(TOURISM_SPONSORS).toHaveLength(10);
    expect(AIRLINE_SPONSORS).toHaveLength(10);
  });

  it("propose trois maillots distincts par sponsor", () => {
    for (const sponsor of sponsors) {
      expect(
        sponsor.jerseys.map((jersey) => jersey.style)
      ).toEqual(["classic", "modern", "bold"]);

      expect(
        new Set(
          sponsor.jerseys.map((jersey) => jersey.name)
        ).size
      ).toBe(3);
    }
  });

  it("couvre vingt pays sans doublon dans cette collection", () => {
    expect(
      new Set(
        sponsors.map((sponsor) => sponsor.countryCode)
      ).size
    ).toBe(20);
  });

  it("respecte le budget de poids des assets", async () => {
    const assetPaths = sponsors.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    const assetSizes = await Promise.all(
      assetPaths.map(async (publicPath) => {
        const absolutePath = path.join(
          process.cwd(),
          "public",
          publicPath.replace(/^\/+/, "")
        );

        return (await stat(absolutePath)).size;
      })
    );

    expect(Math.max(...assetSizes)).toBeLessThanOrEqual(
      100_000
    );

    expect(
      assetSizes.reduce((total, size) => total + size, 0)
    ).toBeLessThanOrEqual(5_000_000);
  });
});
