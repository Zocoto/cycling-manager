export type FanClubSalesReportLine = {
  id: string;
  productId: string;
  unitsSold: number;
  unitPrice: number;
  revenue: number;
  demandFactor: number;
};

export type FanClubDailySalesReport = {
  key: string;
  seasonId: string;
  seasonName: string;
  gameYear: number;
  dayNumber: number;
  calendarDate: string | null;
  processed: boolean;
  unitsSold: number;
  revenue: number;
  lines: FanClubSalesReportLine[];
};

export type FanClubSalesReportState = {
  todayKey: string;
  currentDayNumber: number;
  currentSeasonName: string;
  processedToday: boolean;
  todayUnitsSold: number;
  todayRevenue: number;
  totalUnitsSold: number;
  totalRevenue: number;
  dailyReports: FanClubDailySalesReport[];
};

export type FanClubSalesReportSourceRow = FanClubSalesReportLine & {
  seasonId: string;
  seasonName: string;
  gameYear: number;
  dayNumber: number;
  calendarDate: string | null;
};

export function buildFanClubSalesReport({
  rows,
  currentSeason,
  lastSettledGameDay,
}: {
  rows: ReadonlyArray<FanClubSalesReportSourceRow>;
  currentSeason: {
    id: string;
    name: string;
    gameYear: number;
    dayNumber: number;
    calendarDate: string | null;
  };
  lastSettledGameDay: number | null;
}): FanClubSalesReportState {
  const todayKey = createDailyReportKey(
    currentSeason.id,
    currentSeason.dayNumber,
  );
  const currentGameDay =
    currentSeason.gameYear * 28 + currentSeason.dayNumber - 1;
  const processedToday =
    lastSettledGameDay !== null && lastSettledGameDay >= currentGameDay;
  const reports = new Map<string, FanClubDailySalesReport>();

  for (const row of rows) {
    const key = createDailyReportKey(row.seasonId, row.dayNumber);
    const report = reports.get(key) ?? {
      key,
      seasonId: row.seasonId,
      seasonName: row.seasonName,
      gameYear: row.gameYear,
      dayNumber: row.dayNumber,
      calendarDate: row.calendarDate,
      processed: true,
      unitsSold: 0,
      revenue: 0,
      lines: [],
    };
    report.unitsSold += row.unitsSold;
    report.revenue += row.revenue;
    report.lines.push({
      id: row.id,
      productId: row.productId,
      unitsSold: row.unitsSold,
      unitPrice: row.unitPrice,
      revenue: row.revenue,
      demandFactor: row.demandFactor,
    });
    reports.set(key, report);
  }

  if (!reports.has(todayKey)) {
    reports.set(todayKey, {
      key: todayKey,
      seasonId: currentSeason.id,
      seasonName: currentSeason.name,
      gameYear: currentSeason.gameYear,
      dayNumber: currentSeason.dayNumber,
      calendarDate: currentSeason.calendarDate,
      processed: processedToday,
      unitsSold: 0,
      revenue: 0,
      lines: [],
    });
  } else {
    reports.get(todayKey)!.processed = processedToday;
  }

  const dailyReports = [...reports.values()]
    .map((report) => ({
      ...report,
      revenue: roundCurrency(report.revenue),
      lines: [...report.lines].sort(
        (left, right) =>
          right.revenue - left.revenue || left.productId.localeCompare(right.productId),
      ),
    }))
    .sort(
      (left, right) =>
        right.gameYear - left.gameYear || right.dayNumber - left.dayNumber,
    );
  const today = dailyReports.find((report) => report.key === todayKey)!;

  return {
    todayKey,
    currentDayNumber: currentSeason.dayNumber,
    currentSeasonName: currentSeason.name,
    processedToday,
    todayUnitsSold: today.unitsSold,
    todayRevenue: today.revenue,
    totalUnitsSold: dailyReports.reduce(
      (total, report) => total + report.unitsSold,
      0,
    ),
    totalRevenue: roundCurrency(
      dailyReports.reduce((total, report) => total + report.revenue, 0),
    ),
    dailyReports,
  };
}

function createDailyReportKey(seasonId: string, dayNumber: number): string {
  return `${seasonId}:${dayNumber}`;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
