import type { RaceReward } from "./economy";

export const QUADRENNIAL_GAMES_FEDERATION_PRIZE = 500_000;

// Kept in sync with get_quadrennial_games_club_prize by the isolated SQL test.
export const QUADRENNIAL_GAMES_CLUB_PRIZES = [
  { maxRank: 1, cashPrize: 500_000 },
  { maxRank: 2, cashPrize: 300_000 },
  { maxRank: 3, cashPrize: 200_000 },
  { maxRank: 5, cashPrize: 100_000 },
  { maxRank: 10, cashPrize: 50_000 },
  { maxRank: 20, cashPrize: 20_000 },
  { maxRank: 40, cashPrize: 10_000 },
  { maxRank: Infinity, cashPrize: 4_000 },
] as const;

export function calculateQuadrennialGamesReward(finalRank: number | null): RaceReward {
  const validRank = finalRank !== null && Number.isInteger(finalRank) && finalRank > 0;
  const cashPrize = validRank
    ? QUADRENNIAL_GAMES_CLUB_PRIZES.find((rule) => finalRank <= rule.maxRank)!.cashPrize
    : 0;
  return { cashPrize, reputation: 0, experience: 0, uciPoints: 0 };
}
