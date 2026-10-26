import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { SERVICES_EQUIPMENT_BATCH_20_SPONSORS } from "./services-equipment-batch-20";

const EXPECTED_COUNTRIES = [
  "CG", "GM", "GN", "GQ", "GW", "GY", "IL", "IR", "LA", "LK",
  "LR", "LT", "LV", "LY", "ME", "MM", "MR", "MV", "MW", "MY",
] as const;

describe("services and equipment sponsor batch 20", () => {
  it("adds twenty distinct brands in twenty undercovered countries", () => {
    expect(SERVICES_EQUIPMENT_BATCH_20_SPONSORS).toHaveLength(20);
    expect(new Set(SERVICES_EQUIPMENT_BATCH_20_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(20);
    expect(SERVICES_EQUIPMENT_BATCH_20_SPONSORS.map((sponsor) => sponsor.countryCode).sort()).toEqual([...EXPECTED_COUNTRIES].sort());
  });

  it("covers services, consulting and specialist cycling equipment", () => {
    const sectors = SERVICES_EQUIPMENT_BATCH_20_SPONSORS.map((sponsor) => sponsor.sector.toLowerCase()).join(" ");
    for (const keyword of ["conseil", "logistique", "chronométrage", "transmission", "roulements", "moyeux", "hydratation", "assurances"]) {
      expect(sectors).toContain(keyword);
    }
  });

  it("provides three differentiated jersey choices and complete asset paths", () => {
    for (const sponsor of SERVICES_EQUIPMENT_BATCH_20_SPONSORS) {
      expect(sponsor.jerseys).toHaveLength(3);
      expect(new Set(sponsor.jerseys.map((jersey) => jersey.style))).toEqual(new Set(["classic", "modern", "bold"]));
      expect(sponsor.logoPath).toMatch(/^\/images\/sponsors\/.+\/logo\.webp$/);
    }
  });

  it("keeps a balanced prestige spread", () => {
    const distribution = SERVICES_EQUIPMENT_BATCH_20_SPONSORS.reduce<Record<number, number>>((counts, sponsor) => {
      counts[sponsor.prestige] = (counts[sponsor.prestige] ?? 0) + 1;
      return counts;
    }, {});
    expect(distribution).toEqual({ 1: 3, 2: 5, 3: 6, 4: 3, 5: 3 });
  });

  it("brings every selected country to three sponsors and the catalog to 560", () => {
    expect(SPONSORS).toHaveLength(560);
    for (const countryCode of EXPECTED_COUNTRIES) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(3);
    }
  });
});
