import { describe, expect, it } from "vitest";

import {
  getScoutingSupervisionPercentageForDay,
  getScoutingSupervisionPercentageForReport,
  getScoutingSupervisionReportWindow,
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

describe("scouting supervision report completion", () => {
  it.each([10, 20])(
    "applies the +%i %% object used on J1 to a seven-day mission delivered on J8",
    (percentage) => {
      const effects = [{ percentage, startsDayNumber: 1, endsDayNumber: 7 }];
      expect(getScoutingSupervisionPercentageForReport(effects, 8)).toBe(percentage);
      expect(getScoutingSupervisionPercentageForReport(effects, 9)).toBe(0);
    },
  );

  it("keeps the object active for seven days while preserving its final report", () => {
    const effects = [{ percentage: 20, startsDayNumber: 1, endsDayNumber: 7 }];
    expect(getScoutingSupervisionStatus(effects, 1)).toMatchObject({
      currentPercentage: 20,
      stableThroughDayNumber: 7,
      remainingDays: 7,
    });
    expect(getScoutingSupervisionStatus(effects, 8)).toMatchObject({
      currentPercentage: 0,
      stableThroughDayNumber: null,
      remainingDays: 0,
    });
    expect(getScoutingSupervisionPercentageForReport(effects, 8)).toBe(20);
  });

  it("also benefits a mission already running when the object is activated", () => {
    const effects = [{ percentage: 20, startsDayNumber: 3, endsDayNumber: 9 }];
    expect(getScoutingSupervisionPercentageForReport(effects, 8)).toBe(20);
  });

  it("preserves activation on the delivery day before the report is generated", () => {
    const effects = [{ percentage: 10, startsDayNumber: 8, endsDayNumber: 14 }];
    expect(getScoutingSupervisionPercentageForReport(effects, 8)).toBe(10);
    expect(getScoutingSupervisionPercentageForReport(effects, 7)).toBe(0);
  });

  it("stacks distinct objects but counts a single object only once across both days", () => {
    const effects = [
      { percentage: 10, startsDayNumber: 1, endsDayNumber: 7 },
      { percentage: 20, startsDayNumber: 2, endsDayNumber: 8 },
      { percentage: 30, startsDayNumber: 8, endsDayNumber: 14 },
      { percentage: 40, startsDayNumber: 9, endsDayNumber: 15 },
    ];
    expect(getScoutingSupervisionPercentageForReport(effects, 8)).toBe(60);
    expect(getScoutingSupervisionPercentageForReport([effects[1]], 8)).toBe(20);
  });

  it("preserves the +100 percent cap for stacked report bonuses", () => {
    const effects = [
      { percentage: 80, startsDayNumber: 1, endsDayNumber: 7 },
      { percentage: 40, startsDayNumber: 2, endsDayNumber: 8 },
    ];
    expect(getScoutingSupervisionPercentageForReport(effects, 8)).toBe(100);
  });

  it("shares the exact SQL query window for the final work day and delivery day", () => {
    expect(getScoutingSupervisionReportWindow(8)).toEqual({
      startsOnOrBeforeDayNumber: 8,
      endsOnOrAfterDayNumber: 7,
    });
    expect(getScoutingSupervisionReportWindow(28)).toEqual({
      startsOnOrBeforeDayNumber: 28,
      endsOnOrAfterDayNumber: 27,
    });
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "ignores an invalid report day (%s)",
    (day) => {
      const effects = [{ percentage: 20, startsDayNumber: 1, endsDayNumber: 7 }];
      expect(getScoutingSupervisionReportWindow(day)).toBeNull();
      expect(getScoutingSupervisionPercentageForReport(effects, day)).toBe(0);
    },
  );

  it("ignores malformed effect intervals and invalid percentages", () => {
    expect(getScoutingSupervisionPercentageForReport([
      { percentage: 20, startsDayNumber: 8, endsDayNumber: 7 },
      { percentage: 20, startsDayNumber: 0, endsDayNumber: 7 },
      { percentage: 20, startsDayNumber: 1.5, endsDayNumber: 7 },
      { percentage: 20, startsDayNumber: 1, endsDayNumber: Number.NaN },
      { percentage: Number.NaN, startsDayNumber: 1, endsDayNumber: 7 },
      { percentage: -10, startsDayNumber: 1, endsDayNumber: 7 },
    ], 8)).toBe(0);
  });
});
