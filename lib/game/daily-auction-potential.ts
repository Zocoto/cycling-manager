export const DAILY_AUCTION_POTENTIAL_ROLL_SIZE = 10_000;
export const DAILY_AUCTION_GOLDEN_TICKET_MINIMUM_STEPS = 5;

/**
 * Le potentiel est exprimé en demi-étoiles (1 = 0,5 étoile, 8 = 4 étoiles).
 * Les trois premiers paliers conservent 97 % des arrivages quotidiens.
 * La queue restante crée des talents rares sans concurrencer le centre de formation.
 */
export const DAILY_AUCTION_POTENTIAL_DISTRIBUTION = [
  { potentialSteps: 1, maxRollExclusive: 4_200 },
  { potentialSteps: 2, maxRollExclusive: 8_000 },
  { potentialSteps: 3, maxRollExclusive: 9_700 },
  { potentialSteps: 4, maxRollExclusive: 9_900 },
  { potentialSteps: 5, maxRollExclusive: 9_955 },
  { potentialSteps: 6, maxRollExclusive: 9_980 },
  { potentialSteps: 7, maxRollExclusive: 9_995 },
  { potentialSteps: 8, maxRollExclusive: 10_000 },
] as const;

export function getDailyAuctionPotentialStepsFromRoll(
  roll: number,
) {
  const normalizedRoll = Math.min(
    DAILY_AUCTION_POTENTIAL_ROLL_SIZE - 1,
    Math.max(0, Math.floor(Number.isFinite(roll) ? roll : 0)),
  );

  return (
    DAILY_AUCTION_POTENTIAL_DISTRIBUTION.find(
      (tier) => normalizedRoll < tier.maxRollExclusive,
    )?.potentialSteps ?? 8
  );
}

export function getDailyAuctionPotentialChance(
  minimumPotentialSteps: number,
) {
  const minimum = Math.min(
    8,
    Math.max(1, Math.ceil(minimumPotentialSteps)),
  );
  const precedingTier = DAILY_AUCTION_POTENTIAL_DISTRIBUTION.find(
    (tier) => tier.potentialSteps === minimum - 1,
  );
  const matchingRolls =
    DAILY_AUCTION_POTENTIAL_ROLL_SIZE -
    (precedingTier?.maxRollExclusive ?? 0);

  return matchingRolls / DAILY_AUCTION_POTENTIAL_ROLL_SIZE;
}
