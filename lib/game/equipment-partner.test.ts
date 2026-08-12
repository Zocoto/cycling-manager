import { describe, expect, it } from "vitest";

import {
  canSignEquipmentPartnerContract,
  EQUIPMENT_PARTNER_REPUTATION_THRESHOLD,
  getEquipmentPartnerContractEndYear,
} from "./equipment-partner";

describe("equipment partner rules", () => {
  it("reserves equipment partners for the 200-point endgame threshold", () => {
    expect(EQUIPMENT_PARTNER_REPUTATION_THRESHOLD).toBe(200);
    expect(canSignEquipmentPartnerContract(199.99)).toBe(false);
    expect(canSignEquipmentPartnerContract(200)).toBe(true);
  });

  it("locks a contract to exactly two game seasons", () => {
    expect(getEquipmentPartnerContractEndYear(7)).toBe(8);
  });
});