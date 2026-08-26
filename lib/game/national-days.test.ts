import { describe, expect, it } from "vitest";

import {
  getFeaturedNationalDaysForMarketDate,
  getNationalDayCandidates,
  DYNAMIC_NATIONAL_DAY_COUNTRIES,
  NATIONAL_DAY_CALENDAR,
  NATIONAL_DAY_BONUS_RIDER_COUNT,
  UNASSIGNED_NATIONAL_DAY_COUNTRIES,
} from "@/lib/game/national-days";

describe("calendrier des fêtes nationales", () => {
  it("couvre les 195 pays actifs sans doublon ni pays non affecté", () => {
    const coveredCodes = NATIONAL_DAY_CALENDAR.map((entry) => entry.isoAlpha2);
    const unassignedCodes = UNASSIGNED_NATIONAL_DAY_COUNTRIES.map(
      (entry) => entry.isoAlpha2,
    );

    expect(new Set(coveredCodes).size).toBe(193);
    expect(coveredCodes).toHaveLength(193);
    expect(DYNAMIC_NATIONAL_DAY_COUNTRIES).toEqual(["GB", "IL"]);
    expect(unassignedCodes).toEqual([]);
    expect(
      new Set([...coveredCodes, ...DYNAMIC_NATIONAL_DAY_COUNTRIES]).size,
    ).toBe(195);
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

  it("ajoute les dates fixes approuvées du Koweït et de la Libye", () => {
    expect(getFeaturedNationalDaysForMarketDate("2027-02-25")).toContainEqual({
      isoAlpha2: "KW",
      isExceptionalOverride: false,
    });
    expect(getFeaturedNationalDaysForMarketDate("2027-12-24")).toContainEqual({
      isoAlpha2: "LY",
      isExceptionalOverride: false,
    });
  });

  it("calcule le premier samedi de juin pour le Royaume-Uni", () => {
    expect(getFeaturedNationalDaysForMarketDate("2026-06-06")).toContainEqual({
      isoAlpha2: "GB",
      isExceptionalOverride: false,
    });
    expect(getFeaturedNationalDaysForMarketDate("2027-06-05")).toContainEqual({
      isoAlpha2: "GB",
      isExceptionalOverride: false,
    });
  });

  it("calcule Yom Ha’atzmaout et ses décalages légaux", () => {
    expect(getFeaturedNationalDaysForMarketDate("2026-04-22")).toContainEqual({
      isoAlpha2: "IL",
      isExceptionalOverride: false,
    });
    expect(getFeaturedNationalDaysForMarketDate("2028-05-02")).toContainEqual({
      isoAlpha2: "IL",
      isExceptionalOverride: false,
    });
    expect(getFeaturedNationalDaysForMarketDate("2029-04-19")).toContainEqual({
      isoAlpha2: "IL",
      isExceptionalOverride: false,
    });
  });

  it("ne crée rien les jours sans fête ou pour une date invalide", () => {
    expect(getFeaturedNationalDaysForMarketDate("2026-08-28")).toEqual([]);
    expect(getFeaturedNationalDaysForMarketDate("2026-02-30")).toEqual([]);
    expect(getFeaturedNationalDaysForMarketDate("26-08-2026")).toEqual([]);
  });
});
