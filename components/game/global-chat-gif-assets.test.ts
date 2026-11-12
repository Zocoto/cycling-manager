import { readFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

const gifAssets = [
  "team-train.gif",
  "tactical-attack.gif",
  "feed-zone-chaos.gif",
  "flat-tire-shrug.gif",
  "early-celebration.gif",
  "gel-spray.gif",
];

describe("global chat cycling reaction assets", () => {
  it.each(gifAssets)("keeps the original %s and a smaller, lossless animated WebP", async (filename) => {
    const assetDirectory = join(process.cwd(), "public/images/chat/reactions");
    const gif = readFileSync(join(assetDirectory, filename));
    const webp = readFileSync(join(assetDirectory, filename.replace(/\.gif$/, ".webp")));

    expect(gif.subarray(0, 6).toString("ascii")).toMatch(/^GIF8[79]a$/);
    expect(gif.includes(Buffer.from("NETSCAPE2.0", "ascii"))).toBe(true);
    expect(webp.byteLength).toBeLessThan(gif.byteLength);

    const gifImage = sharp(gif, { animated: true });
    const webpImage = sharp(webp, { animated: true });
    const gifMetadata = await gifImage.metadata();
    expect(await webpImage.metadata()).toMatchObject({
      format: "webp",
      width: gifMetadata.width,
      pageHeight: gifMetadata.pageHeight,
      pages: gifMetadata.pages,
      delay: gifMetadata.delay,
      loop: gifMetadata.loop,
    });
    const gifPixels = await gifImage.ensureAlpha().raw().toBuffer();
    const webpPixels = await webpImage.ensureAlpha().raw().toBuffer();
    expect(webpPixels.equals(gifPixels)).toBe(true);
  });
});
