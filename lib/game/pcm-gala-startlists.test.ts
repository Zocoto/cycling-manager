import { describe, expect, it } from "vitest";

import {
  createPcmStartlistXml,
  validatePcmStartlist,
} from "@/lib/game/pcm-gala-startlists";

describe("startlists gala PCM26", () => {
  it("sérialise le format XML natif attendu par PCM", () => {
    const xml = createPcmStartlistXml([
      { teamId: 243, riderIds: [9001, 9002] },
      { teamId: 244, riderIds: [10001, 10002] },
    ]);

    expect(xml).toContain('<team id="243">');
    expect(xml).toContain('<cyclist id="10002" />');
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="utf-8"\?>\r\n<startlist>/);
    expect(xml).toMatch(/<\/startlist>\r\n$/);
  });

  it("refuse les doublons de coureurs entre équipes", () => {
    expect(() =>
      validatePcmStartlist([
        { teamId: 243, riderIds: [9001] },
        { teamId: 244, riderIds: [9001] },
      ]),
    ).toThrow("présent plusieurs fois");
  });
});

