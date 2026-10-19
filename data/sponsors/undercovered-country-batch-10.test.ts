import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { UNDERCOVERED_COUNTRY_BATCH_10_SPONSORS } from "./undercovered-country-batch-10";

describe("undercovered country sponsor batch 10", () => {
  it("adds five sponsors across five previously single-sponsor countries", () => {
    expect(UNDERCOVERED_COUNTRY_BATCH_10_SPONSORS).toHaveLength(5);
    expect(UNDERCOVERED_COUNTRY_BATCH_10_SPONSORS.map((sponsor) => sponsor.countryCode).sort()).toEqual(["CG", "ER", "GM", "GW", "ZM"]);
    expect(new Set(UNDERCOVERED_COUNTRY_BATCH_10_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(5);
  });

  it("covers common but underrepresented sponsorship sectors", () => {
    const sectors = UNDERCOVERED_COUNTRY_BATCH_10_SPONSORS.map((sponsor) => sponsor.sector.toLowerCase()).join(" ");
    expect(sectors).toContain("assurance");
    expect(sectors).toContain("recrutement");
    expect(sectors).toContain("immobilière");
    expect(sectors).toContain("stations-service");
    expect(sectors).toContain("bricolage");
  });

  it("ships one logo and three brand-led jerseys per sponsor", () => {
    for (const sponsor of UNDERCOVERED_COUNTRY_BATCH_10_SPONSORS) {
      expect(sponsor.logoPath).toBe(`/images/sponsors/${sponsor.id}/logo.webp`);
      expect(sponsor.jerseys).toHaveLength(3);
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual(["classic", "modern", "bold"]);
      expect(new Set(sponsor.jerseys.map((jersey) => jersey.imagePath)).size).toBe(3);
    }
  });

  it("brings the complete catalog to 435 sponsors", () => {
    expect(SPONSORS).toHaveLength(435);
  });
});
