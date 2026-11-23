import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { TELECOM_BATCH_24_SPONSORS } from "./telecom-batch-24";

const EXPECTED_COUNTRIES = ["AF", "AZ", "BD", "BF", "BI", "BO", "BZ", "CF", "CU", "DJ"];

describe("telecom sponsor batch 24", () => {
  it("adds ten unique sponsors across ten previously underrepresented countries", () => {
    expect(TELECOM_BATCH_24_SPONSORS).toHaveLength(10);
    expect(new Set(TELECOM_BATCH_24_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(10);
    expect(TELECOM_BATCH_24_SPONSORS.map((sponsor) => sponsor.countryCode).sort()).toEqual([...EXPECTED_COUNTRIES].sort());
  });

  it("keeps every activity within the telecom theme", () => {
    for (const sponsor of TELECOM_BATCH_24_SPONSORS) {
      expect(sponsor.sector).toMatch(/mobile|téléph|internet|fibre|5G|réseau|câble|Wi-Fi/i);
    }
  });

  it("provides three canonical and distinct jersey variants per sponsor", () => {
    for (const sponsor of TELECOM_BATCH_24_SPONSORS) {
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual(["classic", "modern", "bold"]);
      expect(new Set(sponsor.jerseys.map((jersey) => jersey.imagePath)).size).toBe(3);
      expect(sponsor.jerseys.every((jersey) => jersey.imagePath.endsWith(".webp"))).toBe(true);
    }
  });

  it("distributes prestige from entry level to international operators", () => {
    const counts = TELECOM_BATCH_24_SPONSORS.reduce<Record<number, number>>((result, sponsor) => {
      result[sponsor.prestige] = (result[sponsor.prestige] ?? 0) + 1;
      return result;
    }, {});
    expect(counts).toEqual({ 1: 2, 2: 3, 3: 3, 4: 1, 5: 1 });
  });

  it("raises each selected country to four sponsors and the catalog to 620", () => {
    expect(SPONSORS).toHaveLength(620);
    for (const countryCode of EXPECTED_COUNTRIES) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(4);
    }
  });
});
