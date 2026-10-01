import { describe, expect, it } from "vitest";

import { SPONSORS } from ".";
import { PRIORITY_PARTNERSHIP_BATCH_01_SPONSORS } from "./priority-partnership-batch-01";

describe("priority partnership sponsor batch 01", () => {
  it("adds three Moldovan and two Romanian sponsors", () => {
    expect(PRIORITY_PARTNERSHIP_BATCH_01_SPONSORS).toHaveLength(5);
    expect(
      Object.fromEntries(
        ["MD", "RO"].map((countryCode) => [
          countryCode,
          PRIORITY_PARTNERSHIP_BATCH_01_SPONSORS.filter(
            (sponsor) => sponsor.countryCode === countryCode
          ).length,
        ])
      )
    ).toEqual({ MD: 3, RO: 2 });
  });

  it("brings Moldova to five sponsors and Romania to four before batch 02", () => {
    expect(SPONSORS.filter((sponsor) => sponsor.countryCode === "MD")).toHaveLength(5);
    expect(SPONSORS.filter((sponsor) => sponsor.countryCode === "RO")).toHaveLength(4);
  });

  it("provides three unique WebP jersey variants per sponsor", () => {
    for (const sponsor of PRIORITY_PARTNERSHIP_BATCH_01_SPONSORS) {
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual([
        "classic",
        "modern",
        "bold",
      ]);
      expect(new Set(sponsor.jerseys.map((jersey) => jersey.imagePath)).size).toBe(3);
      expect(sponsor.logoPath).toMatch(
        /^\/images\/sponsors\/[a-z0-9-]+\/logo\.webp$/
      );
    }
  });

  it("publie les secteurs et descriptions en français", () => {
    for (const sponsor of PRIORITY_PARTNERSHIP_BATCH_01_SPONSORS) {
      expect(sponsor.description).toMatch(/^(?:Un|Une) /u);
      expect(sponsor.description).not.toMatch(/\b(?:din|care|pentru|și|în)\b/iu);
    }
  });
});
