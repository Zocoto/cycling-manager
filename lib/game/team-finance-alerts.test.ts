import { describe, expect, it } from "vitest";

import {
  getDebtAmount,
  getNextFinancialCheckpointDay,
} from "@/lib/game/team-finance-alerts";

describe("team finance alerts", () => {
  it("affiche la dette à rembourser plutôt que le solde positif actuel", () => {
    expect(getDebtAmount(-2_850)).toBe(2_850);
    expect(getDebtAmount(59_050)).toBe(0);
  });

  it("retourne le prochain contrôle hebdomadaire", () => {
    expect(getNextFinancialCheckpointDay(18)).toBe(21);
    expect(getNextFinancialCheckpointDay(21)).toBe(28);
    expect(getNextFinancialCheckpointDay(28)).toBeNull();
  });
});
