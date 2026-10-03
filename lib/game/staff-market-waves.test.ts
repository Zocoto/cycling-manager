import { describe, expect, it } from "vitest";

import {
  STAFF_MARKET_DAILY_COUNT,
  STAFF_MARKET_DAILY_WAVE_COUNT,
  STAFF_MARKET_WAVE_SIZE,
  getCurrentStaffMarketWaveIndex,
  getDueStaffMarketWaveIndexes,
  getParisHour,
  isStaffMarketRefreshHour,
  isStaffMarketRefreshRoute,
} from "@/lib/game/staff-market-waves";

describe("staff market waves", () => {
  it("répartit soixante profils en douze vagues de cinq", () => {
    expect(STAFF_MARKET_WAVE_SIZE).toBe(5);
    expect(STAFF_MARKET_DAILY_WAVE_COUNT).toBe(12);
    expect(STAFF_MARKET_DAILY_COUNT).toBe(60);
  });

  it("déclenche toutes les deux heures à l’heure de Paris en été", () => {
    const parisMidnight = new Date("2026-08-26T22:00:00.000Z");
    const parisNoon = new Date("2026-08-26T10:00:00.000Z");

    expect(getParisHour(parisMidnight)).toBe(0);
    expect(isStaffMarketRefreshHour(parisMidnight)).toBe(true);
    expect(isStaffMarketRefreshHour(parisNoon)).toBe(true);
    expect(getCurrentStaffMarketWaveIndex(parisNoon)).toBe(6);
  });

  it("conserve les heures parisiennes en hiver", () => {
    const parisMidnight = new Date("2026-01-15T23:00:00.000Z");
    const parisNoon = new Date("2026-01-15T11:00:00.000Z");

    expect(isStaffMarketRefreshHour(parisMidnight)).toBe(true);
    expect(isStaffMarketRefreshHour(parisNoon)).toBe(true);
    expect(getCurrentStaffMarketWaveIndex(parisNoon)).toBe(6);
  });

  it("ignore les heures impaires et valide uniquement la route de rafraîchissement", () => {
    expect(
      isStaffMarketRefreshHour(new Date("2026-08-26T23:00:00.000Z")),
    ).toBe(false);
    expect(isStaffMarketRefreshRoute("refresh")).toBe(true);
    expect(isStaffMarketRefreshRoute("midnight")).toBe(false);
  });

  it("énumère toutes les vagues à rattraper jusqu’au créneau courant", () => {
    expect(
      getDueStaffMarketWaveIndexes(new Date("2026-08-26T15:30:00.000Z")),
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
