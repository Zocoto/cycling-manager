import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";

function resolvePublicAsset(assetPath: string): string {
  return resolve(process.cwd(), "public", assetPath.replace(/^\//, ""));
}

describe("sponsor asset performance budget", () => {
  it("serves every catalog logo and jersey as an existing WebP asset", () => {
    const assetPaths = SPONSORS.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);

    expect(assetPaths).toHaveLength(SPONSORS.length * 4);

    for (const assetPath of assetPaths) {
      expect(assetPath.endsWith(".webp"), assetPath).toBe(true);
      expect(existsSync(resolvePublicAsset(assetPath)), assetPath).toBe(true);
    }
  });

  it("keeps directly embedded jersey artwork below 200 KB", () => {
    for (const sponsor of SPONSORS) {
      for (const jersey of sponsor.jerseys) {
        const assetSize = statSync(resolvePublicAsset(jersey.imagePath)).size;

        expect(assetSize, jersey.imagePath).toBeLessThanOrEqual(200 * 1024);
      }
    }
  });
});
