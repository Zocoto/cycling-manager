import { describe, expect, it } from "vitest";

import { buildFanClubSalesReport } from "@/lib/game/fan-club-sales-report";

describe("Fan Club sales report", () => {
  it("groups product lines by day and keeps the current CR first", () => {
    const report = buildFanClubSalesReport({
      rows: [
        {
          id: "sale-1",
          seasonId: "season-2",
          seasonName: "Saison 2",
          gameYear: 2,
          dayNumber: 7,
          calendarDate: "2026-09-04",
          productId: "cap",
          unitsSold: 3,
          unitPrice: 25,
          revenue: 75,
          demandFactor: 1.2,
        },
        {
          id: "sale-2",
          seasonId: "season-2",
          seasonName: "Saison 2",
          gameYear: 2,
          dayNumber: 7,
          calendarDate: "2026-09-04",
          productId: "bottle",
          unitsSold: 5,
          unitPrice: 10,
          revenue: 50,
          demandFactor: 0.9,
        },
      ],
      currentSeason: {
        id: "season-2",
        name: "Saison 2",
        gameYear: 2,
        dayNumber: 8,
        calendarDate: "2026-09-05",
      },
      lastSettledGameDay: 63,
    });

    expect(report.processedToday).toBe(true);
    expect(report.dailyReports.map((day) => day.dayNumber)).toEqual([8, 7]);
    expect(report.dailyReports[1]).toEqual(
      expect.objectContaining({ unitsSold: 8, revenue: 125 }),
    );
    expect(report.totalUnitsSold).toBe(8);
    expect(report.totalRevenue).toBe(125);
  });

  it("distinguishes a scheduled current report from a processed zero-sale day", () => {
    const pending = buildFanClubSalesReport({
      rows: [],
      currentSeason: {
        id: "season-2",
        name: "Saison 2",
        gameYear: 2,
        dayNumber: 8,
        calendarDate: "2026-09-05",
      },
      lastSettledGameDay: 62,
    });
    const processed = buildFanClubSalesReport({
      rows: [],
      currentSeason: {
        id: "season-2",
        name: "Saison 2",
        gameYear: 2,
        dayNumber: 8,
        calendarDate: "2026-09-05",
      },
      lastSettledGameDay: 63,
    });

    expect(pending.dailyReports[0]?.processed).toBe(false);
    expect(processed.dailyReports[0]?.processed).toBe(true);
    expect(processed.todayUnitsSold).toBe(0);
  });
});
