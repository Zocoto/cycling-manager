import { describe, expect, it } from "vitest";
import { normalizeDailyFormCampReport, parseFormCampReportDay } from "./daily-form-camp-report";

const rider = {
  riderId: "00000000-0000-4000-8000-000000000001", firstName: "Jean", lastName: "Morel",
  campType: "premium", startDayNumber: 3, endDayNumber: 5,
  formBefore: 96, formAfter: 100, formDelta: 20,
};
const report = {
  teamName: "Équipe Test", seasonName: "Saison 4", dayNumber: 4, currentDayNumber: 5,
  calendarDate: "2026-10-12", riders: [rider], riderCount: 99, totalFormGain: 99,
};

describe("daily form-camp report", () => {
  it("reports actual capped gains instead of nominal camp deltas or supplied totals", () => {
    expect(normalizeDailyFormCampReport(report)).toMatchObject({
      riderCount: 1, totalFormGain: 4, riders: [{ formDelta: 4, formBefore: 96, formAfter: 100 }],
    });
  });

  it("retains a settled camp at maximum form with zero actual gain", () => {
    expect(normalizeDailyFormCampReport({ ...report, riders: [{ ...rider, formBefore: 100 }] }))
      .toMatchObject({ riderCount: 1, totalFormGain: 0, riders: [{ formDelta: 0 }] });
  });

  it("deduplicates riders and rejects invalid, unrelated, or out-of-day camp rows", () => {
    const result = normalizeDailyFormCampReport({ ...report, riders: [rider, rider, null,
      { ...rider, riderId: "<script>" },
      { ...rider, riderId: "00000000-0000-4000-8000-000000000002", campType: "wind_tunnel" },
      { ...rider, riderId: "00000000-0000-4000-8000-000000000003", startDayNumber: 5 },
      { ...rider, riderId: "00000000-0000-4000-8000-000000000004", formBefore: 101 },
      { ...rider, riderId: "00000000-0000-4000-8000-000000000005", formAfter: 90 },
    ] });
    expect(result?.riders).toHaveLength(1);
    expect(result?.totalFormGain).toBe(4);
  });

  it.each([null, [], {}, { ...report, dayNumber: 5 }, { ...report, currentDayNumber: 29 },
    { ...report, calendarDate: "2026-02-30" }, { ...report, riders: null }])
    ("does not invent a report from malformed or not-yet-completed data (%j)", value => {
      expect(normalizeDailyFormCampReport(value)).toBeNull();
    });

  it("supports the empty first day without pretending a stage has already settled", () => {
    expect(normalizeDailyFormCampReport({ ...report, dayNumber: 1, currentDayNumber: 1, riders: [] }))
      .toMatchObject({ riderCount: 0, totalFormGain: 0 });
    expect(normalizeDailyFormCampReport({ ...report, dayNumber: 1, currentDayNumber: 1, riders: [
      { ...rider, startDayNumber: 1, endDayNumber: 1 },
    ] })).toBeNull();
  });

  it.each([["4", 4], [["3", "5"], 3], ["28", 28], ["0", null], ["29", null],
    ["4junk", null], ["4.5", null], ["-1", null], [undefined, null]])
    ("parses a bounded integer day from %j", (value, expected) => {
      expect(parseFormCampReportDay(value as string | string[] | undefined)).toBe(expected);
    });
});
