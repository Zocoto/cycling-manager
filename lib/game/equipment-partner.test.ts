import { describe, expect, it } from "vitest";

import {
  canSignEquipmentPartnerContract,
  EQUIPMENT_PARTNER_REPUTATION_THRESHOLD,
  getEquipmentPartnerContractEndYear,
  getEquipmentPartnerRndDelta,
  resolveEquipmentPartnerRndOutcome,
  shouldGenerateRareEquipmentOffer,
} from "./equipment-partner";

describe("equipment partner rules", () => {
  it("unlocks equipment partners from 50 reputation points", () => {
    expect(EQUIPMENT_PARTNER_REPUTATION_THRESHOLD).toBe(50);
    expect(canSignEquipmentPartnerContract(49.99)).toBe(false);
    expect(canSignEquipmentPartnerContract(50)).toBe(true);
  });

  it("locks a contract to exactly two game seasons", () => {
    expect(getEquipmentPartnerContractEndYear(7)).toBe(8);
  });

  it("splits R&D outcomes evenly and applies a one-point step", () => {
    expect(resolveEquipmentPartnerRndOutcome(0.4999)).toBe("improvement");
    expect(resolveEquipmentPartnerRndOutcome(0.5)).toBe("setback");
    expect(getEquipmentPartnerRndDelta("improvement")).toBe(1);
    expect(getEquipmentPartnerRndDelta("setback")).toBe(-1);
  });

  it("keeps accessory offers rare", () => {
    expect(shouldGenerateRareEquipmentOffer(0.0999)).toBe(true);
    expect(shouldGenerateRareEquipmentOffer(0.1)).toBe(false);
  });
});
