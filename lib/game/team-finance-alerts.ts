export const FINANCIAL_CHECKPOINT_DAYS = [7, 14, 21, 28] as const;

export function getDebtAmount(checkpointBalance: number): number {
  return Math.max(0, -checkpointBalance);
}

export function getNextFinancialCheckpointDay(dayNumber: number): number | null {
  return FINANCIAL_CHECKPOINT_DAYS.find((checkpoint) => checkpoint > dayNumber) ?? null;
}
