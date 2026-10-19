import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { UNDERCOVERED_VIVID_BATCH_11_SPONSORS } from "./undercovered-vivid-batch-11";

describe("undercovered vivid sponsor batch 11", () => {
  it("adds five brands from countries that previously had one sponsor", () => {
    expect(UNDERCOVERED_VIVID_BATCH_11_SPONSORS).toHaveLength(5);
    expect(UNDERCOVERED_VIVID_BATCH_11_SPONSORS.map((sponsor) => sponsor.countryCode).sort()).toEqual([
      "IL",
      "KW",
      "OM",
      "VU",
      "ZW",
    ]);
    expect(new Set(UNDERCOVERED_VIVID_BATCH_11_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(5);
  });

  it("covers five distinct consumer-facing industries", () => {
    const sectors = UNDERCOVERED_VIVID_BATCH_11_SPONSORS.map((sponsor) => sponsor.sector.toLowerCase()).join(" ");
    expect(sectors).toContain("snacking");
    expect(sectors).toContain("cafés");
    expect(sectors).toContain("céramique");
    expect(sectors).toContain("kava");
    expect(sectors).toContain("audio");
  });

  it("keeps a balanced prestige range and complete branded assets", () => {
    expect(UNDERCOVERED_VIVID_BATCH_11_SPONSORS.map((sponsor) => sponsor.prestige).sort()).toEqual([2, 3, 3, 4, 4]);
    for (const sponsor of UNDERCOVERED_VIVID_BATCH_11_SPONSORS) {
      expect(sponsor.logoPath).toBe(`/images/sponsors/${sponsor.id}/logo.webp`);
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual(["classic", "modern", "bold"]);
    }
  });

  it("brings the catalog to 445 sponsors and each selected nation to two", () => {
    expect(SPONSORS).toHaveLength(445);
    for (const countryCode of ["IL", "KW", "OM", "VU", "ZW"]) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(2);
    }
  });
});
