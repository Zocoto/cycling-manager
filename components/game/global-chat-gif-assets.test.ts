import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const gifAssets = [
  "feed-zone-chaos.gif",
  "flat-tire-shrug.gif",
  "early-celebration.gif",
  "snack-hoarder.gif",
];

describe("global chat cycling GIF assets", () => {
  it.each(gifAssets)("ships %s as a looping GIF", (filename) => {
    const file = readFileSync(
      join(process.cwd(), "public/images/chat/reactions", filename),
    );

    expect(file.subarray(0, 6).toString("ascii")).toMatch(/^GIF8[79]a$/);
    expect(file.includes(Buffer.from("NETSCAPE2.0", "ascii"))).toBe(true);
    expect(file.byteLength).toBeGreaterThan(10_000);
  });
});
