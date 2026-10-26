import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { OPEN_SECTOR_BATCH_21_SPONSORS } from "./open-sector-batch-21";

const EXPECTED_COUNTRIES = [
  "NA", "NE", "NI", "NO", "NP", "NZ", "OM", "PA", "PE", "PG",
  "PK", "PS", "PY", "QA", "RS", "RU", "SB", "SD", "SG", "SI",
] as const;

describe("open sector sponsor batch 21", () => {
  it("adds twenty distinct brands in twenty least-covered countries", () => {
    expect(OPEN_SECTOR_BATCH_21_SPONSORS).toHaveLength(20);
    expect(new Set(OPEN_SECTOR_BATCH_21_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(20);
    expect(OPEN_SECTOR_BATCH_21_SPONSORS.map((sponsor) => sponsor.countryCode).sort()).toEqual([...EXPECTED_COUNTRIES].sort());
  });

  it("covers a deliberately broad range of activities", () => {
    const sectors = OPEN_SECTOR_BATCH_21_SPONSORS.map((sponsor) => sponsor.sector.toLowerCase()).join(" ");
    for (const keyword of ["cartographie", "archivage", "navigation", "météo", "outillage", "biosécurité", "logiciel", "freins", "hospitalité", "billetterie"]) {
      expect(sectors).toContain(keyword);
    }
  });

  it("provides three differentiated jersey choices and complete asset paths", () => {
    for (const sponsor of OPEN_SECTOR_BATCH_21_SPONSORS) {
      expect(sponsor.jerseys).toHaveLength(3);
      expect(new Set(sponsor.jerseys.map((jersey) => jersey.style))).toEqual(new Set(["classic", "modern", "bold"]));
      expect(sponsor.logoPath).toMatch(/^\/images\/sponsors\/.+\/logo\.webp$/);
    }
  });

  it("keeps a balanced prestige spread", () => {
    const distribution = OPEN_SECTOR_BATCH_21_SPONSORS.reduce<Record<number, number>>((counts, sponsor) => {
      counts[sponsor.prestige] = (counts[sponsor.prestige] ?? 0) + 1;
      return counts;
    }, {});
    expect(distribution).toEqual({ 1: 3, 2: 5, 3: 6, 4: 3, 5: 3 });
  });

  it("brings every selected country to three sponsors and the catalog to 580", () => {
    expect(SPONSORS).toHaveLength(580);
    for (const countryCode of EXPECTED_COUNTRIES) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(3);
    }
  });
});
