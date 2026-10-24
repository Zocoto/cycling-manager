import { describe, expect, it } from "vitest";

import { BANK_INSURANCE_BATCH_14_SPONSORS } from "./bank-insurance-batch-14";
import { SPONSORS } from "./index";

describe("bank and insurance sponsor batch 14", () => {
  const expectedCountryCodes = ["IR", "RU", "SY", "AF", "AL", "AM", "AZ", "BF", "BO", "KH"];

  it("adds ten sponsors to the least represented countries", () => {
    expect(BANK_INSURANCE_BATCH_14_SPONSORS).toHaveLength(10);
    expect(BANK_INSURANCE_BATCH_14_SPONSORS.map((sponsor) => sponsor.countryCode).sort()).toEqual(
      [...expectedCountryCodes].sort(),
    );
    expect(new Set(BANK_INSURANCE_BATCH_14_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(10);
  });

  it("keeps a balanced banking and insurance portfolio", () => {
    const banks = BANK_INSURANCE_BATCH_14_SPONSORS.filter((sponsor) => sponsor.sector.toLowerCase().includes("banque"));
    const insurers = BANK_INSURANCE_BATCH_14_SPONSORS.filter((sponsor) => sponsor.sector.toLowerCase().includes("assurance"));
    expect(banks).toHaveLength(5);
    expect(insurers).toHaveLength(5);
    expect(new Set(BANK_INSURANCE_BATCH_14_SPONSORS.map((sponsor) => sponsor.colors.primary)).size).toBe(10);
  });

  it("covers all prestige levels with three branded jerseys each", () => {
    expect(new Set(BANK_INSURANCE_BATCH_14_SPONSORS.map((sponsor) => sponsor.prestige))).toEqual(new Set([1, 2, 3, 4, 5]));
    for (const sponsor of BANK_INSURANCE_BATCH_14_SPONSORS) {
      expect(sponsor.logoPath).toBe(`/images/sponsors/${sponsor.id}/logo.webp`);
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual(["classic", "modern", "bold"]);
    }
  });

  it("brings the catalog to 470 sponsors and raises the three rarest countries to two", () => {
    expect(SPONSORS).toHaveLength(470);
    for (const countryCode of ["IR", "RU", "SY"]) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(2);
    }
    for (const countryCode of expectedCountryCodes.filter((code) => !["IR", "RU", "SY"].includes(code))) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(3);
    }
  });
});
