import { describe, expect, it } from "vitest";

import {
  DAILY_AUCTION_GOLDEN_TICKET_MINIMUM_STEPS,
  DAILY_AUCTION_POTENTIAL_DISTRIBUTION,
  DAILY_AUCTION_POTENTIAL_ROLL_SIZE,
  getDailyAuctionPotentialChance,
  getDailyAuctionPotentialStepsFromRoll,
} from "@/lib/game/daily-auction-potential";

describe("daily auction potential", () => {
  it("conserve 97 % des arrivages dans les trois paliers historiques", () => {
    expect(getDailyAuctionPotentialChance(4)).toBe(0.03);
  });

  it("réserve exactement 1 % des arrivages aux tickets d'or", () => {
    expect(DAILY_AUCTION_GOLDEN_TICKET_MINIMUM_STEPS).toBe(5);
    expect(
      getDailyAuctionPotentialChance(
        DAILY_AUCTION_GOLDEN_TICKET_MINIMUM_STEPS,
      ),
    ).toBe(0.01);
  });

  it("rend les potentiels de 3,5 et 4 étoiles exceptionnellement rares", () => {
    expect(getDailyAuctionPotentialChance(7)).toBe(0.002);
    expect(getDailyAuctionPotentialChance(8)).toBe(0.0005);
  });

  it("couvre sans trou les dix mille tirages déterministes", () => {
    const counts = new Map<number, number>();

    for (let roll = 0; roll < DAILY_AUCTION_POTENTIAL_ROLL_SIZE; roll += 1) {
      const steps = getDailyAuctionPotentialStepsFromRoll(roll);
      counts.set(steps, (counts.get(steps) ?? 0) + 1);
    }

    const expectedCounts = DAILY_AUCTION_POTENTIAL_DISTRIBUTION.map(
      (tier, index) =>
        tier.maxRollExclusive -
        (DAILY_AUCTION_POTENTIAL_DISTRIBUTION[index - 1]
          ?.maxRollExclusive ?? 0),
    );

    expect(
      DAILY_AUCTION_POTENTIAL_DISTRIBUTION.map(
        (tier) => counts.get(tier.potentialSteps),
      ),
    ).toEqual(expectedCounts);
  });

  it("respecte les frontières entre les paliers rares", () => {
    expect(getDailyAuctionPotentialStepsFromRoll(9_699)).toBe(3);
    expect(getDailyAuctionPotentialStepsFromRoll(9_700)).toBe(4);
    expect(getDailyAuctionPotentialStepsFromRoll(9_899)).toBe(4);
    expect(getDailyAuctionPotentialStepsFromRoll(9_900)).toBe(5);
    expect(getDailyAuctionPotentialStepsFromRoll(9_999)).toBe(8);
  });
});
