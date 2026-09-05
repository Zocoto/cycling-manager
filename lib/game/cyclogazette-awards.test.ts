import { describe, expect, it } from "vitest";

import { selectCyclogazetteOpeningAwards } from "./cyclogazette-awards";

const archive = [
  {
    gameYear: 3,
    editions: [{ id: "season-3-day-1" }],
  },
];

const awards = [
  { id: "season-1", gameYear: 1 },
  { id: "season-2-a", gameYear: 2 },
  { id: "season-2-b", gameYear: 2 },
];

describe("selectCyclogazetteOpeningAwards", () => {
  it("publie au J1 le dernier palmarès disponible", () => {
    expect(
      selectCyclogazetteOpeningAwards(
        { id: "season-3-day-1", dayNumber: 1 },
        archive,
        awards,
      ),
    ).toEqual([
      { id: "season-2-a", gameYear: 2 },
      { id: "season-2-b", gameYear: 2 },
    ]);
  });

  it("ne publie aucun encart après le J1", () => {
    expect(
      selectCyclogazetteOpeningAwards(
        { id: "season-3-day-1", dayNumber: 2 },
        archive,
        awards,
      ),
    ).toEqual([]);
  });
});
