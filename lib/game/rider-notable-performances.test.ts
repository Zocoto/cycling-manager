import { describe, expect, it } from "vitest";

import {
  buildNotablePerformanceLabels,
  formatSeasonPerformanceButtonLabel,
  shortlistNotablePerformances,
  type RiderNotablePerformance,
} from "./rider-notable-performances";

describe("rider notable performances", () => {
  it("décrit une place et les classements annexes remportés", () => {
    expect(
      buildNotablePerformanceLabels({
        finalRank: 4,
        nationalChampionshipType: null,
        secondaryWins: ["mountain", "youth"],
      })
    ).toEqual(["Top 5 · 4e", "Meilleur grimpeur", "Meilleur jeune"]);
  });

  it("met le titre national en avant à la place du libellé générique", () => {
    expect(
      buildNotablePerformanceLabels({
        finalRank: 1,
        nationalChampionshipType: "time_trial",
        secondaryWins: [],
      })
    ).toEqual(["Champion national CLM"]);
  });

  it("conserve les cinq performances ayant rapporté le plus de points", () => {
    const performances: RiderNotablePerformance[] = Array.from(
      { length: 7 },
      (_, index) => ({
        raceEditionId: `edition-${index}`,
        raceName: `Course ${index}`,
        uciPoints: index * 10,
        labels: ["Performance classée"],
        finalRank: 10 - index,
      })
    );

    expect(
      shortlistNotablePerformances(performances).map(
        (performance) => performance.uciPoints
      )
    ).toEqual([60, 50, 40, 30, 20]);
  });

  it("produit le libellé compact demandé pour la saison", () => {
    expect(
      formatSeasonPerformanceButtonLabel({
        seasonName: "Saison 1",
        gameYear: 2026,
      })
    ).toBe("Performances S1");
  });
});
