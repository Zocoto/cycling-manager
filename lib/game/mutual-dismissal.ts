export function isMutualAgreementDismissal(cashBalance: number) {
  return Number.isFinite(cashBalance) && cashBalance < 0;
}

export function resolveDismissalCost(
  cashBalance: number,
  regularCost: number,
) {
  return isMutualAgreementDismissal(cashBalance) ? 0 : regularCost;
}
