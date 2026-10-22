import { describe, expect, it } from "vitest";
import { calculateQuadrennialGamesReward, QUADRENNIAL_GAMES_FEDERATION_PRIZE } from "./quadrennial-games-rewards";

describe("Quadrennial Games cash prizes", () => {
  it.each([
    [1, 500_000], [2, 300_000], [3, 200_000], [4, 100_000], [5, 100_000],
    [6, 50_000], [10, 50_000], [11, 20_000], [20, 20_000], [21, 10_000],
    [40, 10_000], [41, 4_000], [220, 4_000],
  ])("rank %s earns %s for the club", (rank, cashPrize) => {
    expect(calculateQuadrennialGamesReward(rank)).toEqual({ cashPrize, reputation: 0, experience: 0, uciPoints: 0 });
  });
  it.each([null, 0, -1, 1.5, NaN, Infinity])("invalid or absent rank %s earns nothing", (rank) => {
    expect(calculateQuadrennialGamesReward(rank).cashPrize).toBe(0);
  });
  it("keeps the federation winner prize separate", () => {
    expect(QUADRENNIAL_GAMES_FEDERATION_PRIZE).toBe(500_000);
  });
});
