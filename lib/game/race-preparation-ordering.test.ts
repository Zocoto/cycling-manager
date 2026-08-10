import { describe, expect, it } from "vitest";

import { compareRacePreparationEditionsByDate } from "@/lib/game/race-preparation-ordering";

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
