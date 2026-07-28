import { describe, expect, it } from "vitest";

import {
  calculateAmateurRenewalSalary,
  calculateAvailableTransferBudget,
  calculateMinimumNextBid,
  calculateTransferStartingPrice,
  calculateWeeklySalary,
  isTransferRiderProfileFilter,
  matchesTransferRiderProfile,
} from "./transfer-market";

describe("transfer market economy", () => {
  it("équilibre les prix d’appel sous le plafond de niveau 65", () => {
    expect(calculateTransferStartingPrice({ overall: 45, age: 28 })).toBe(3_000);
    expect(calculateTransferStartingPrice({ overall: 65, age: 22 })).toBe(35_500);
  });

  it("impose une surenchère lisible et proportionnelle", () => {
    expect(calculateMinimumNextBid(3_000)).toBe(3_500);
    expect(calculateMinimumNextBid(100_000)).toBe(102_000);
  });

  it("présente le salaire saisonnier sous forme de quatre semaines", () => {
    expect(calculateWeeklySalary(9_900)).toBe(2_475);
  });

  it("conserve les amateurs sous 60 sans salaire puis professionnalise les autres", () => {
    expect(calculateAmateurRenewalSalary(59.99)).toBe(0);
    expect(calculateAmateurRenewalSalary(60)).toBeGreaterThan(0);
  });

  it("réserve les enchères déjà gagnantes dans le budget projeté", () => {
    expect(
      calculateAvailableTransferBudget({
        cashBalance: 5_000,
        pendingTransactions: 50_000,
        reservedWinningBids: 12_000,
      })
    ).toBe(43_000);
  });

  it("reconnaît les profils proposés par le filtre", () => {
    expect(isTransferRiderProfileFilter("Grimpeur")).toBe(true);
    expect(isTransferRiderProfileFilter("Coureur équilibré")).toBe(true);
    expect(isTransferRiderProfileFilter("Profil inconnu")).toBe(false);
  });

  it("inclut un profil hybride dans chacune de ses spécialités", () => {
    expect(
      matchesTransferRiderProfile("Grimpeur / Puncheur", "Grimpeur")
    ).toBe(true);
    expect(
      matchesTransferRiderProfile("Grimpeur / Puncheur", "Puncheur")
    ).toBe(true);
    expect(
      matchesTransferRiderProfile("Grimpeur / Puncheur", "Sprinteur")
    ).toBe(false);
  });

  it("réserve le filtre équilibré aux seuls coureurs équilibrés", () => {
    expect(
      matchesTransferRiderProfile(
        "Coureur équilibré",
        "Coureur équilibré"
      )
    ).toBe(true);
    expect(
      matchesTransferRiderProfile("Grimpeur", "Coureur équilibré")
    ).toBe(false);
  });
});
