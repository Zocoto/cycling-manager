import { describe, expect, it } from "vitest";

import {
  buildJuniorDailyTrainingRiders,
  buildSeniorDailyTrainingRiders,
  formatDailyTrainingRiderSentence,
  resolveTrainingReportDay,
  summarizeDailyTrainingReport,
} from "@/lib/game/daily-training-report";

const riders = [
  { id: "rider-b", firstName: "Zoé", lastName: "Bernard" },
  { id: "rider-a", firstName: "Alice", lastName: "Armand" },
];

describe("daily training text reports", () => {
  it("lists every senior and exposes both gains and missing reports", () => {
    const report = buildSeniorDailyTrainingRiders({
      riders,
      sessions: [
        {
          riderId: "rider-b",
          status: "completed",
          ratingChanges: { mountain: 1, time_trial: 1 },
          formBefore: 80,
          formDelta: -4,
          formAfter: 76,
        },
      ],
    });

    expect(report.map((rider) => rider.riderId)).toEqual([
      "rider-a",
      "rider-b",
    ]);
    expect(formatDailyTrainingRiderSentence(report[0]!)).toBe(
      "Aucun rapport enregistré pour cette journée.",
    );
    expect(report[1]?.statChanges.map((change) => change.shortLabel)).toEqual([
      "MO",
      "CLM",
    ]);
    expect(formatDailyTrainingRiderSentence(report[1]!)).toContain(
      "forme 80 → 76 (-4)",
    );
  });

  it("aggregates two junior sessions and projects raw gains to the displayed scale", () => {
    const report = buildJuniorDailyTrainingRiders({
      riders: [riders[0]!],
      sessions: [
        {
          riderId: "rider-b",
          trainingMode: "manual",
          slot: "manual_am",
          gameType: "rhythm",
          ratingChanges: { mountain: 0.025 },
        },
        {
          riderId: "rider-b",
          trainingMode: "manual",
          slot: "manual_pm",
          gameType: "reflex",
          ratingChanges: { mountain: 0.05, timeTrial: 0.025 },
        },
      ],
    });

    expect(report[0]).toEqual(
      expect.objectContaining({
        sessionCount: 2,
        trainingModes: ["manuel matin", "manuel après-midi"],
      }),
    );
    expect(report[0]?.statChanges).toEqual([
      expect.objectContaining({ shortLabel: "MO", value: 0.6 }),
      expect.objectContaining({ shortLabel: "CLM", value: 0.2 }),
    ]);
    expect(summarizeDailyTrainingReport(report)).toEqual(
      expect.objectContaining({
        sessionCount: 2,
        progressedRiderCount: 1,
        totalPositiveChange: 0.8,
      }),
    );
  });

  it("defaults to today and clamps navigation to the season already played", () => {
    expect(resolveTrainingReportDay(undefined, 18)).toBe(18);
    expect(resolveTrainingReportDay("0", 18)).toBe(1);
    expect(resolveTrainingReportDay("99", 18)).toBe(18);
    expect(resolveTrainingReportDay("12", 18)).toBe(12);
  });
});
