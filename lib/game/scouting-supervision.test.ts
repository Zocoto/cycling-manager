import { describe, expect, it } from "vitest";

import {
  getScoutingSupervisionPercentageForDay,
  getScoutingSupervisionStatus,
  normalizeScoutingSupervisionEffects,
} from "@/lib/game/scouting-supervision";

describe("scouting supervision", () => {
  const effects = [
    { percentage: 10, startsDayNumber: 4, endsDayNumber: 10 },
    { percentage: 20, startsDayNumber: 6, endsDayNumber: 12 },
  ];

  it("cumule les bonus actifs au jour du rapport", () => {
    expect(getScoutingSupervisionPercentageForDay(effects, 5)).toBe(10);
    expect(getScoutingSupervisionPercentageForDay(effects, 8)).toBe(30);
    expect(getScoutingSupervisionPercentageForDay(effects, 11)).toBe(20);
    expect(getScoutingSupervisionPercentageForDay(effects, 13)).toBe(0);
  });

  it("annonce la durée pendant laquelle le cumul complet reste garanti", () => {
    expect(getScoutingSupervisionStatus(effects, 7)).toMatchObject({
      currentPercentage: 30,
      stableThroughDayNumber: 10,
      remainingDays: 4,
    });
  });

  it("normalise les lignes SQL et ignore les bonus invalides", () => {
    expect(
      normalizeScoutingSupervisionEffects([
        {
          effect_payload: { percentage: "20" },
          starts_day_number: 3,
          ends_day_number: 9,
        },
        {
          effectPayload: { percentage: "invalide" },
          startsDayNumber: 3,
          endsDayNumber: 9,
        },
      ]),
    ).toEqual([
      { percentage: 20, startsDayNumber: 3, endsDayNumber: 9 },
    ]);
  });

  it("plafonne le cumul à +100 % pour préserver l’équilibrage", () => {
    expect(
      getScoutingSupervisionPercentageForDay(
        [
          { percentage: 80, startsDayNumber: 1, endsDayNumber: 28 },
          { percentage: 40, startsDayNumber: 1, endsDayNumber: 28 },
        ],
        5,
      ),
    ).toBe(100);
  });
});
