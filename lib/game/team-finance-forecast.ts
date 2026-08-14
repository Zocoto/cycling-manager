export type FinanceForecastEntry = {
  amount: number;
  status: "pending" | "posted" | "cancelled";
};

export type FutureFinanceSummary = {
  futureIncome: number;
  futureExpenses: number;
  futureNet: number;
  projectedBalance: number;
};

export function summarizeFutureFinances({
  currentBalance,
  entries,
}: {
  currentBalance: number;
  entries: readonly FinanceForecastEntry[];
}): FutureFinanceSummary {
  const futureEntries = entries.filter((entry) => entry.status === "pending");
  const futureIncome = futureEntries.reduce(
    (total, entry) => total + Math.max(0, entry.amount),
    0,
  );
  const futureExpenses = futureEntries.reduce(
    (total, entry) => total + Math.abs(Math.min(0, entry.amount)),
    0,
  );
  const futureNet = futureIncome - futureExpenses;

  return {
    futureIncome,
    futureExpenses,
    futureNet,
    projectedBalance: currentBalance + futureNet,
  };
}
