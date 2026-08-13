const MINIMUM_SATISFACTION_SCORE = 0;
const NEUTRAL_SATISFACTION_SCORE = 50;
const MAXIMUM_SATISFACTION_SCORE = 100;

export function getSponsorRenewalBudgetAdjustmentPercent(
  satisfactionScore: number,
): number {
  const normalizedScore = Math.min(
    MAXIMUM_SATISFACTION_SCORE,
    Math.max(MINIMUM_SATISFACTION_SCORE, satisfactionScore),
  );

  if (normalizedScore <= NEUTRAL_SATISFACTION_SCORE) {
    return (normalizedScore - NEUTRAL_SATISFACTION_SCORE) / 2;
  }

  return (normalizedScore - NEUTRAL_SATISFACTION_SCORE) / 5;
}

export function calculateSponsorRenewalBudget({
  currentBudget,
  satisfactionScore,
}: {
  currentBudget: number;
  satisfactionScore: number;
}): number {
  if (!Number.isFinite(currentBudget) || currentBudget <= 0) {
    throw new Error("Le budget sponsor actuel doit être strictement positif.");
  }

  if (!Number.isFinite(satisfactionScore)) {
    throw new Error("La satisfaction sponsor doit être un nombre valide.");
  }

  const adjustmentPercent =
    getSponsorRenewalBudgetAdjustmentPercent(satisfactionScore);

  return Math.round(
    currentBudget * (1 + adjustmentPercent / 100),
  );
}
