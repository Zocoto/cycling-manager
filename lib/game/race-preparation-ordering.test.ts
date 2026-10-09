import { describe, expect, it } from "vitest";

import {
  compareRacePreparationEditionsByDate,
  compareRacePreparationNavigationEditionsByDate,
} from "@/lib/game/race-preparation-ordering";

describe("race preparation edition ordering", () => {
  it("sorts races by first day and departure time", () => {
    const editions = [
      createEdition("Course tardive", 12, "2026-08-20T18:00:00.000Z"),
      createEdition("Course matinale", 12, "2026-08-20T14:00:00.000Z"),
      createEdition("Course précédente", 8, "2026-08-16T18:00:00.000Z"),
    ];

    expect(
      editions
        .sort(compareRacePreparationEditionsByDate)
        .map((edition) => edition.name),
    ).toEqual([
      "Course précédente",
      "Course matinale",
      "Course tardive",
    ]);
  });

  it("places editions without stages last", () => {
    const editions = [
      { name: "Sans date", stages: [] },
      createEdition("Avec date", 5, null),
    ];

    expect(
      editions
        .sort(compareRacePreparationEditionsByDate)
        .map((edition) => edition.name),
    ).toEqual(["Avec date", "Sans date"]);
  });

  it("uses real departure dates before day indices", () => {
    const editions = [
      createEdition("Lointaine", 1, "2026-10-28T17:00:00Z"),
      createEdition("Proche", 10, "2026-10-10T17:00:00Z"),
    ];
    expect(editions.sort(compareRacePreparationEditionsByDate).map(edition => edition.name))
      .toEqual(["Proche", "Lointaine"]);
  });

  it("finds the first stage without reordering the original tour", () => {
    const tour = { name: "Tour", stages: [
      { dayNumber: 8, stageNumber: 2, departureAt: "2026-10-16T17:00:00Z" },
      { dayNumber: 7, stageNumber: 1, departureAt: "2026-10-15T17:00:00Z" },
    ] };
    const original = [...tour.stages];
    const editions = [createEdition("Classique", 8, "2026-10-16T12:00:00Z"), tour];
    expect(editions.sort(compareRacePreparationEditionsByDate)[0]).toBe(tour);
    expect(tour.stages).toEqual(original);
  });

  it("sorts the lightweight navigation by day and actual time, not input order", () => {
    const menu = [
      { name: "Z tôt", startDayNumber: 2, startDepartureAt: "2026-10-10T18:00:00+02:00" },
      { name: "A tard", startDayNumber: 2, startDepartureAt: "2026-10-10T17:00:00Z" },
      { name: "Encore plus loin", startDayNumber: 5, startDepartureAt: "2026-10-13T12:00:00Z" },
      { name: "Première", startDayNumber: 1, startDepartureAt: "2026-10-09T19:00:00Z" },
    ];
    expect(menu.sort(compareRacePreparationNavigationEditionsByDate).map(edition => edition.name))
      .toEqual(["Première", "Z tôt", "A tard", "Encore plus loin"]);
  });

  it("places missing or invalid dates last with deterministic fallback ordering", () => {
    const menu = [
      { name: "Sans jour", startDayNumber: null, startDepartureAt: null },
      { name: "Date invalide", startDayNumber: 2, startDepartureAt: "invalid" },
      { name: "Datée", startDayNumber: 7, startDepartureAt: "2026-10-15T17:00:00Z" },
      { name: "Date manquante", startDayNumber: 3, startDepartureAt: null },
    ];
    expect(menu.sort(compareRacePreparationNavigationEditionsByDate).map(edition => edition.name))
      .toEqual(["Datée", "Date invalide", "Date manquante", "Sans jour"]);
  });
});

function createEdition(
  name: string,
  dayNumber: number,
  departureAt: string | null,
) {
  return {
    name,
    stages: [{ dayNumber, departureAt, stageNumber: 1 }],
  };
}
