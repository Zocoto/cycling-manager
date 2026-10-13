import { describe, expect, it } from "vitest";
import { halloweenConsumableTarget, halloweenDoseLimit, halloweenDosePreview, halloweenTargetDescription } from "./halloween-consumables";
import type { ItemTargetRider } from "./item-target-values";

const rider: ItemTargetRider = { id: "r", name: "Test", firstName: "T", lastName: "R", countryName: "France", form: 60, experienceDays: 12, potentialSteps: 4, ratings: {} as ItemTargetRider["ratings"], abilityCodes: [], age: 27, heightCm: 180, weightKg: 72, injury: null };
describe("usage cohérent des consommables Halloween", () => {
  it("six jus donnent 30 points et ne dépassent jamais la forme utile", () => {
    expect(halloweenDoseLimit("pumpkin-juice", 6, rider)).toBe(6);
    expect(halloweenDosePreview("pumpkin-juice", 6, rider)).toBe("Forme : 60 → 90/100.");
    expect(halloweenDoseLimit("pumpkin-juice", 6, { ...rider, form: 97.5 })).toBe(1);
    expect(halloweenDoseLimit("pumpkin-juice", 6, { ...rider, form: 100 })).toBe(0);
    expect(halloweenTargetDescription("pumpkin-juice", { ...rider, form: 97.5 })).toBe("Forme 97,5/100");
  });
  it("refuse les potions de forme bloquées par la fatigue sans sacrifier le stock", () => {
    const injured = { ...rider, injury: { id: "i", diagnosisCode: "fatigue_exhaustion", label: "Fatigue", remainingHours: 48, expectedRecoveryAt: "2026-10-15", canShorten: false } };
    for (const item of ["pumpkin-juice", "full-moon-elixir", "mummy-bandage"]) expect(halloweenDoseLimit(item, 6, injured)).toBe(0);
    expect(halloweenDoseLimit("mummy-resurrection", 6, injured)).toBe(1);
    expect(halloweenTargetDescription("pumpkin-juice", injured)).toContain("bloquée");
  });
  it("adapte la quantité à la morphologie, au potentiel et à l’âge", () => {
    expect(halloweenDoseLimit("spectres-tea", 30, rider)).toBe(13);
    expect(halloweenDoseLimit("giants-syrup", 30, rider)).toBe(10);
    expect(halloweenDoseLimit("witches-star", 5, rider)).toBe(2);
    expect(halloweenDoseLimit("witches-star", 5, { ...rider, potentialSteps: 7 })).toBe(0);
    expect(halloweenDoseLimit("youth-fountain", 5, rider)).toBe(3);
    expect(halloweenDoseLimit("youth-fountain", 5, { ...rider, age: 24 })).toBe(0);
    expect(halloweenTargetDescription("spectres-tea", rider)).toContain("72 kg · 180 cm · IMC 22,22");
    expect(halloweenDosePreview("giants-syrup", 3, rider)).toContain("180 → 186 cm");
    expect(halloweenDosePreview("midnight-chocolate", 4, rider)).toContain("12 → 16 jours");
    expect(halloweenDosePreview("witches-star", 2, rider)).toContain("2 → 4/4");
    expect(halloweenDosePreview("youth-fountain", 2, rider)).toContain("27 → 25 ans");
  });
  it("ne cumule que les durées utiles et distingue les cibles", () => {
    const injured = { ...rider, injury: { id: "i", diagnosisCode: "fall", label: "Chute", remainingHours: 25, expectedRecoveryAt: "2026-10-15", canShorten: true } };
    expect(halloweenDoseLimit("mummy-bandage", 10, injured)).toBe(3);
    expect(halloweenDoseLimit("mummy-resurrection", 5, rider)).toBe(0);
    const project = { id: "p", name: "Centre", targetLevel: 2, remainingDays: 8 };
    expect(halloweenDoseLimit("gravediggers-hourglass", 10, undefined, project)).toBe(4);
    expect(halloweenDosePreview("gravediggers-hourglass", 4, undefined, project)).toContain("8 → 1 jours");
    expect(halloweenDosePreview("scouts-candy", 3)).toContain("72 h");
    expect(halloweenDosePreview("immortality-pact", 3)).toContain("252 matinées");
    expect(halloweenConsumableTarget("scouts-candy")).toBe("team");
    expect(halloweenConsumableTarget("headless-frame-claim")).toBe("team");
    expect(halloweenConsumableTarget("cursed-builders-seal")).toBe("project");
    expect(halloweenConsumableTarget("pumpkin-juice")).toBe("rider");
    for (const item of ["full-moon-elixir", "cursed-builders-seal", "headless-frame-claim"]) expect(halloweenDoseLimit(item, 20)).toBe(1);
  });
});
