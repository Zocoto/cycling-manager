import { describe, expect, it } from "vitest";

import {
  getParisHour,
  hasStaffMarketNoonWaveStarted,
  isStaffMarketWaveDue,
} from "@/lib/game/staff-market-waves";

describe("staff market waves", () => {
  it("déclenche minuit et midi à l’heure de Paris en été", () => {
    const parisMidnight = new Date("2026-08-26T22:00:00.000Z");
    const parisNoon = new Date("2026-08-26T10:00:00.000Z");

    expect(getParisHour(parisMidnight)).toBe(0);
    expect(isStaffMarketWaveDue("midnight", parisMidnight)).toBe(true);
    expect(isStaffMarketWaveDue("noon", parisNoon)).toBe(true);
  });

  it("déclenche minuit et midi à l’heure de Paris en hiver", () => {
    const parisMidnight = new Date("2026-01-15T23:00:00.000Z");
    const parisNoon = new Date("2026-01-15T11:00:00.000Z");

    expect(isStaffMarketWaveDue("midnight", parisMidnight)).toBe(true);
    expect(isStaffMarketWaveDue("noon", parisNoon)).toBe(true);
  });

  it("ignore le second appel UTC prévu uniquement pour le changement d’heure", () => {
    expect(
      isStaffMarketWaveDue("midnight", new Date("2026-08-26T23:00:00.000Z")),
    ).toBe(false);
    expect(
      isStaffMarketWaveDue("noon", new Date("2026-01-15T10:00:00.000Z")),
    ).toBe(false);
  });

  it("autorise le rattrapage de la vague de midi pendant tout l’après-midi", () => {
    expect(
      hasStaffMarketNoonWaveStarted(new Date("2026-08-26T09:59:59.000Z")),
    ).toBe(false);
    expect(
      hasStaffMarketNoonWaveStarted(new Date("2026-08-26T15:30:00.000Z")),
    ).toBe(true);
  });
});
