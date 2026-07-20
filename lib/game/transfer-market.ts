import { calculateRiderSeasonSalary } from "@/lib/game/economy";

export const DAILY_TRANSFER_RIDER_COUNT = 5;
export const DAILY_AUCTION_OPEN_HOUR = 9;
export const DAILY_AUCTION_CLOSE_HOUR = 18;
export const DIRECTOR_AUCTION_DURATION_HOURS = 24;
export const AMATEUR_SALARY_THRESHOLD = 60;

export function calculateTransferStartingPrice({
  overall,
  age,
}: {
  overall: number;
  age: number;
}) {
  const safeOverall = clamp(overall, 0, 65);
  const youngTalentBonus = Math.max(0, 24 - clamp(age, 15, 60)) * 250;
  const rawPrice =
    3_000 + Math.max(0, safeOverall - 45) ** 2 * 80 + youngTalentBonus;

  return Math.max(2_500, Math.round(rawPrice / 500) * 500);
}

export function calculateMinimumNextBid(currentAmount: number) {
  const safeAmount = Math.max(0, currentAmount);
  const increment = Math.max(500, Math.ceil((safeAmount * 0.02) / 100) * 100);

  return safeAmount + increment;
}

export function calculateWeeklySalary(seasonSalary: number) {
  return Math.round(Math.max(0, seasonSalary) / 4);
}

export function calculateAmateurRenewalSalary(overall: number) {
  if (overall < AMATEUR_SALARY_THRESHOLD) return 0;

  return calculateRiderSeasonSalary({ overall });
}

export function calculateAvailableTransferBudget({
  cashBalance,
  pendingTransactions,
  reservedWinningBids = 0,
}: {
  cashBalance: number;
  pendingTransactions: number;
  reservedWinningBids?: number;
}) {
  return Math.max(
    0,
    cashBalance + pendingTransactions - Math.max(0, reservedWinningBids)
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
