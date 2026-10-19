import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { AMERICAN_EXPANSION_BATCH_02_SPONSORS } from "./united-states-batch-02";

describe("American sponsor expansion batch 02", () => {
  it("adds five distinct American sponsors", () => {
    expect(AMERICAN_EXPANSION_BATCH_02_SPONSORS).toHaveLength(5);
    expect(AMERICAN_EXPANSION_BATCH_02_SPONSORS.every((sponsor) => sponsor.countryCode === "US")).toBe(true);
    expect(new Set(AMERICAN_EXPANSION_BATCH_02_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(5);
  });

  it("covers characteristic American industries missing from the national offer", () => {
    const sectors = AMERICAN_EXPANSION_BATCH_02_SPONSORS.map((sponsor) => sponsor.sector.toLowerCase()).join(" ");
    expect(sectors).toContain("assurance");
    expect(sectors).toContain("aérospatial");
    expect(sectors).toContain("cinéma");
    expect(sectors).toContain("diners");
    expect(sectors).toContain("distribution en club");
  });

  it("offers a broad prestige range with complete branded assets", () => {
    expect(AMERICAN_EXPANSION_BATCH_02_SPONSORS.map((sponsor) => sponsor.prestige).sort()).toEqual([2, 3, 4, 4, 5]);
    for (const sponsor of AMERICAN_EXPANSION_BATCH_02_SPONSORS) {
      expect(sponsor.logoPath).toBe(`/images/sponsors/${sponsor.id}/logo.webp`);
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual(["classic", "modern", "bold"]);
    }
  });

  it("brings the complete catalog to 440 sponsors", () => {
    expect(SPONSORS).toHaveLength(440);
    expect(SPONSORS.filter((sponsor) => sponsor.countryCode === "US")).toHaveLength(12);
  });
});
