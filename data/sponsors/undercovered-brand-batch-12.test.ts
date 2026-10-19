import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { UNDERCOVERED_BRAND_BATCH_12_SPONSORS } from "./undercovered-brand-batch-12";

describe("undercovered brand sponsor batch 12", () => {
  it("adds five brands from countries that previously had one sponsor", () => {
    expect(UNDERCOVERED_BRAND_BATCH_12_SPONSORS).toHaveLength(5);
    expect(UNDERCOVERED_BRAND_BATCH_12_SPONSORS.map((sponsor) => sponsor.countryCode).sort()).toEqual([
      "ML",
      "MR",
      "SB",
      "SL",
      "TJ",
    ]);
    expect(new Set(UNDERCOVERED_BRAND_BATCH_12_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(5);
  });

  it("covers five distinct and plausible sponsorship industries", () => {
    const sectors = UNDERCOVERED_BRAND_BATCH_12_SPONSORS.map((sponsor) => sponsor.sector.toLowerCase()).join(" ");
    expect(sectors).toContain("construction");
    expect(sectors).toContain("laitiers");
    expect(sectors).toContain("assurance");
    expect(sectors).toContain("maritime");
    expect(sectors).toContain("aérien");
  });

  it("keeps a broad prestige range and complete branded assets", () => {
    expect(UNDERCOVERED_BRAND_BATCH_12_SPONSORS.map((sponsor) => sponsor.prestige).sort()).toEqual([2, 2, 3, 3, 4]);
    for (const sponsor of UNDERCOVERED_BRAND_BATCH_12_SPONSORS) {
      expect(sponsor.logoPath).toBe(`/images/sponsors/${sponsor.id}/logo.webp`);
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual(["classic", "modern", "bold"]);
    }
  });

  it("brings the catalog to 450 sponsors and each selected nation to two", () => {
    expect(SPONSORS).toHaveLength(450);
    for (const countryCode of ["ML", "MR", "SB", "SL", "TJ"]) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(2);
    }
  });
});
