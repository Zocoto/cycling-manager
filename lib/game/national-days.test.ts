import { describe, expect, it } from "vitest";

import {
  getFeaturedNationalDaysForMarketDate,
  getNationalDayCandidates,
  NATIONAL_DAY_CALENDAR,
  NATIONAL_DAY_BONUS_RIDER_COUNT,
  UNASSIGNED_NATIONAL_DAY_COUNTRIES,
} from "@/lib/game/national-days";

describe("calendrier des fêtes nationales", () => {
  it("couvre 191 des 195 pays actifs sans doublon de pays", () => {
    const coveredCodes = NATIONAL_DAY_CALENDAR.map((entry) => entry.isoAlpha2);
    const unassignedCodes = UNASSIGNED_NATIONAL_DAY_COUNTRIES.map(
      (entry) => entry.isoAlpha2,
    );

    expect(new Set(coveredCodes).size).toBe(191);
    expect(coveredCodes).toHaveLength(191);
    expect(unassignedCodes).toEqual(["GB", "IL", "KW", "LY"]);
    expect(new Set([...coveredCodes, ...unassignedCodes]).size).toBe(195);
  });

  it("applique le rattrapage uruguayen le 26 août 2026", () => {
    expect(getFeaturedNationalDaysForMarketDate("2026-08-26")).toEqual([
      { isoAlpha2: "UY", isExceptionalOverride: true },
    ]);
  });

  it("reprend le calendrier normal avec la Moldavie le 27 août", () => {
    expect(getFeaturedNationalDaysForMarketDate("2026-08-27")).toEqual([
      { isoAlpha2: "MD", isExceptionalOverride: false },
    ]);
  });

  it("honore simultanément toutes les fêtes partageant une date", () => {
    expect(getNationalDayCandidates(9, 15)).toEqual([
      "CR",
      "GT",
      "HN",
      "NI",
      "SV",
    ]);
    expect(getFeaturedNationalDaysForMarketDate("2026-09-15")).toHaveLength(5);
    expect(10 + 5 * NATIONAL_DAY_BONUS_RIDER_COUNT).toBe(35);
  });

  it("ne crée rien les jours sans fête ou pour une date invalide", () => {
    expect(getFeaturedNationalDaysForMarketDate("2026-08-28")).toEqual([]);
    expect(getFeaturedNationalDaysForMarketDate("2026-02-30")).toEqual([]);
    expect(getFeaturedNationalDaysForMarketDate("26-08-2026")).toEqual([]);
  });
});
