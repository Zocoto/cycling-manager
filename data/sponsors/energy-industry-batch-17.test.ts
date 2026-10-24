import { describe, expect, it } from "vitest";

import { ENERGY_INDUSTRY_BATCH_17_SPONSORS } from "./energy-industry-batch-17";
import { SPONSORS } from "./index";

describe("energy industry sponsor batch 17", () => {
  const expectedCountryCodes = ["AO", "DZ", "NG", "HU", "BG", "AE", "DK", "IE", "TH", "PH"];

  it("adds ten energy sponsors to countries tied at the current minimum", () => {
    expect(ENERGY_INDUSTRY_BATCH_17_SPONSORS).toHaveLength(10);
    expect(ENERGY_INDUSTRY_BATCH_17_SPONSORS.map((sponsor) => sponsor.countryCode).sort()).toEqual(
      [...expectedCountryCodes].sort(),
    );
    expect(new Set(ENERGY_INDUSTRY_BATCH_17_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(10);
  });

  it("balances fossil, nuclear and alternative technologies", () => {
    const sectors = ENERGY_INDUSTRY_BATCH_17_SPONSORS.map((sponsor) => sponsor.sector).join(" ").toLowerCase();
    expect(sectors).toContain("pétroli");
    expect(sectors).toContain("gaz naturel");
    expect(sectors.match(/nucléaire/g)?.length).toBe(3);
    expect(sectors).toContain("biogaz");
    expect(sectors).toContain("piézoélectriques");
    expect(sectors).toContain("marémotrice");
  });

  it("covers all prestige levels with three branded jerseys each", () => {
    expect(new Set(ENERGY_INDUSTRY_BATCH_17_SPONSORS.map((sponsor) => sponsor.prestige))).toEqual(new Set([1, 2, 3, 4, 5]));
    for (const sponsor of ENERGY_INDUSTRY_BATCH_17_SPONSORS) {
      expect(sponsor.logoPath).toBe(`/images/sponsors/${sponsor.id}/logo.webp`);
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual(["classic", "modern", "bold"]);
    }
  });

  it("brings the catalog to 500 sponsors and raises each selected country to three", () => {
    expect(SPONSORS).toHaveLength(500);
    for (const countryCode of expectedCountryCodes) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(3);
    }
  });
});
