import { describe, expect, it } from "vitest";

import {
  buildFinanceProjection,
  calculateDebtReputationPenalty,
  calculateNationalChampionshipReward,
  calculateRaceReward,
  calculateRiderSeasonSalary,
  calculateStagePrize,
  getDivisionForRank,
  selectWildcardTeams,
} from "./economy";

describe("calculateRaceReward", () => {
  it("respecte le barème de réputation d’un grand tour Élite", () => {
    expect(
      calculateRaceReward({ tier: "elite", scope: "grand_tour", finalRank: 2 })
        .reputation
    ).toBe(20);
    expect(
      calculateRaceReward({ tier: "elite", scope: "grand_tour", finalRank: 8 })
        .reputation
    ).toBe(5);
    expect(
      calculateRaceReward({ tier: "elite", scope: "grand_tour", finalRank: 18 })
        .reputation
    ).toBe(2);
  });

  it("cumule classements secondaires et primes sans dupliquer une catégorie", () => {
    const reward = calculateRaceReward({
      tier: "world",
      scope: "tour",
      finalRank: 4,
      secondaryClassifications: ["mountain", "sprint", "mountain"],
      mountainPrimesWon: 2,
      intermediateSprintsWon: 1,
    });

    expect(reward.reputation).toBe(8);
    expect(reward.experience).toBe(274);
    expect(reward.cashPrize).toBe(16_750);
    expect(reward.uciPoints).toBe(275);
  });

  it("attribue des points UCI au-delà du podium sans donner de réputation", () => {
    const reward = calculateRaceReward({
      tier: "national",
      scope: "one_day",
      finalRank: 8,
    });

    expect(reward.reputation).toBe(0);
    expect(reward.experience).toBe(6);
    expect(reward.uciPoints).toBe(2);
  });
});

describe("calculateNationalChampionshipReward", () => {
  it("récompense le podium sans jamais attribuer de points UCI", () => {
    expect(calculateNationalChampionshipReward({ finalRank: 1 })).toEqual({
      reputation: 5,
      experience: 125,
      cashPrize: 10_000,
      uciPoints: 0,
    });
    expect(calculateNationalChampionshipReward({ finalRank: 3 }).uciPoints).toBe(0);
    expect(calculateNationalChampionshipReward({ finalRank: 8 })).toEqual({
      reputation: 0,
      experience: 0,
      cashPrize: 0,
      uciPoints: 0,
    });
  });
});

describe("calculateStagePrize", () => {
  it("récompense les meilleures places d'une étape selon la catégorie", () => {
    expect(calculateStagePrize({ tier: "national", finalRank: 1 })).toBe(600);
    expect(calculateStagePrize({ tier: "continental", finalRank: 4 })).toBe(250);
    expect(calculateStagePrize({ tier: "world", finalRank: 8 })).toBe(250);
    expect(calculateStagePrize({ tier: "elite", finalRank: 2 })).toBe(7_000);
  });

  it("ne verse rien hors du top rémunéré ou en cas d'abandon", () => {
    expect(calculateStagePrize({ tier: "national", finalRank: 6 })).toBe(0);
    expect(calculateStagePrize({ tier: "elite", finalRank: 11 })).toBe(0);
    expect(calculateStagePrize({ tier: "world", finalRank: null })).toBe(0);
  });
});

describe("calculateRiderSeasonSalary", () => {
  it("maintient les amateurs sans salaire et encadre les professionnels", () => {
    expect(calculateRiderSeasonSalary({ overall: 90, isAmateur: true })).toBe(0);
    expect(calculateRiderSeasonSalary({ overall: 20 })).toBe(2_500);
    expect(
      calculateRiderSeasonSalary({
        overall: 100,
        previousSeasonUciPoints: 5_000,
        majorWins: 10,
      })
    ).toBe(150_000);
  });

  it("valorise le niveau puis le palmarès", () => {
    const emerging = calculateRiderSeasonSalary({ overall: 72 });
    const established = calculateRiderSeasonSalary({
      overall: 72,
      previousSeasonUciPoints: 300,
      majorWins: 2,
    });

    expect(established).toBeGreaterThan(emerging);
  });
});

describe("division et dette", () => {
  it("utilise des frontières sans chevauchement", () => {
    expect(getDivisionForRank(20)).toBe("elite");
    expect(getDivisionForRank(21)).toBe("world");
    expect(getDivisionForRank(50)).toBe("world");
    expect(getDivisionForRank(51)).toBe("continental");
    expect(getDivisionForRank(100)).toBe("continental");
    expect(getDivisionForRank(101)).toBe("national");
    expect(getDivisionForRank(201)).toBe("amateur");
  });

  it("applique une pénalité forte mais plafonnée après récidive", () => {
    expect(calculateDebtReputationPenalty(0)).toBe(0);
    expect(calculateDebtReputationPenalty(-1)).toBe(12);
    expect(calculateDebtReputationPenalty(-1_000_000)).toBe(35);
  });
});

describe("buildFinanceProjection", () => {
  it("sépare la courbe réelle de la prévision et ignore les lignes annulées", () => {
    const points = buildFinanceProjection({
      currentDayNumber: 8,
      entries: [
        { dayNumber: 7, amount: 100_000, status: "posted" },
        { dayNumber: 7, amount: -20_000, status: "posted" },
        { dayNumber: 14, amount: 100_000, status: "pending" },
        { dayNumber: 21, amount: 100_000, status: "cancelled" },
      ],
    });

    expect(points[6]).toEqual({
      dayNumber: 7,
      actualBalance: 80_000,
      projectedBalance: 80_000,
    });
    expect(points[7]?.actualBalance).toBe(80_000);
    expect(points[13]).toEqual({
      dayNumber: 14,
      actualBalance: null,
      projectedBalance: 180_000,
    });
    expect(points[20]?.projectedBalance).toBe(180_000);
  });
});

describe("selectWildcardTeams", () => {
  it("privilégie les demandes dont le leader correspond au profil", () => {
    const selected = selectWildcardTeams(
      [
        { teamId: "a", rankingPosition: 30, uciPoints: 500, leaderProfileFit: 72, requested: true },
        { teamId: "b", rankingPosition: 45, uciPoints: 350, leaderProfileFit: 91, requested: true },
        { teamId: "c", rankingPosition: 12, uciPoints: 900, leaderProfileFit: 99, requested: true },
        { teamId: "d", rankingPosition: 60, uciPoints: 300, leaderProfileFit: 95, requested: false },
      ],
      2
    );

    expect(selected.map((candidate) => candidate.teamId)).toEqual(["b", "a"]);
  });

  it("prioritizes World, Continental, then National teams", () => {
    const selected = selectWildcardTeams(
      [
        { teamId: "world-b", rankingPosition: 45, uciPoints: 350, leaderProfileFit: 91, requested: true },
        { teamId: "world-a", rankingPosition: 30, uciPoints: 500, leaderProfileFit: 72, requested: true },
        { teamId: "continental", rankingPosition: 60, uciPoints: 300, leaderProfileFit: 99, requested: true },
        { teamId: "national", rankingPosition: 120, uciPoints: 150, leaderProfileFit: 99, requested: true },
        { teamId: "elite", rankingPosition: 12, uciPoints: 900, leaderProfileFit: 100, requested: true },
        { teamId: "amateur", rankingPosition: 220, uciPoints: 50, leaderProfileFit: 100, requested: true },
        { teamId: "not-requested", rankingPosition: 25, uciPoints: 800, leaderProfileFit: 100, requested: false },
      ],
      4
    );

    expect(selected.map((candidate) => candidate.teamId)).toEqual([
      "world-b",
      "world-a",
      "continental",
      "national",
    ]);
  });
});
