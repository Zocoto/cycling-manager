export type PurchaseFinancialRisk = {
  currency: string;
  currentProjectedBalance: number;
  projectedBalanceAfterPurchase: number;
  requiresConfirmation: boolean;
  wasAlreadyNegative: boolean;
};

export function calculatePurchaseFinancialRisk({
  currentProjectedBalance,
  expense,
  currency = "EUR",
}: {
  currentProjectedBalance: number;
  expense: number;
  currency?: string;
}): PurchaseFinancialRisk {
  const safeProjection = Number.isFinite(currentProjectedBalance)
    ? currentProjectedBalance
    : 0;
  const safeExpense = Number.isFinite(expense) ? Math.max(0, expense) : 0;
  const projectedBalanceAfterPurchase = roundMoney(
    safeProjection - safeExpense,
  );

  return {
    currency,
    currentProjectedBalance: roundMoney(safeProjection),
    projectedBalanceAfterPurchase,
    requiresConfirmation:
      safeExpense > 0 && projectedBalanceAfterPurchase < 0,
    wasAlreadyNegative: safeProjection < 0,
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
