import { describe, expect, it } from "vitest";

import {
  getCyclogazetteOpeningSourceGameYear,
  selectCyclogazetteGalaAwards,
  selectCyclogazetteOpeningAwards,
} from "./cyclogazette-awards";

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
  it("retrouve la saison source du gala pour le J1 suivant", () => {
    const seasonFourArchive = [
      { gameYear: 4, editions: [{ id: "season-4-day-1" }] },
    ];

    expect(
      getCyclogazetteOpeningSourceGameYear(
        { id: "season-4-day-1", dayNumber: 1 },
        seasonFourArchive,
      ),
    ).toBe(3);
  });

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

describe("selectCyclogazetteGalaAwards", () => {
  it("publie le palmarès de la saison 2 dans son édition J28", () => {
    const seasonTwoArchive = [
      { gameYear: 2, editions: [{ id: "season-2-day-28" }] },
    ];
    expect(
      selectCyclogazetteGalaAwards(
        { id: "season-2-day-28", dayNumber: 28 },
        seasonTwoArchive,
        awards,
      ),
    ).toEqual([
      { id: "season-2-a", gameYear: 2 },
      { id: "season-2-b", gameYear: 2 },
    ]);
  });

  it("affiche les awards de J28 de chaque saison, sans reprendre une autre année", () => {
    expect(
      selectCyclogazetteGalaAwards(
        { id: "season-3-day-1", dayNumber: 28 },
        archive,
        [...awards, { id: "season-3", gameYear: 3 }],
      ),
    ).toEqual([{ id: "season-3", gameYear: 3 }]);
  });
  it("ne présente pas un ancien palmarès comme celui de la saison précédente", () => {
    expect(selectCyclogazetteOpeningAwards({ id: "season-4-day-1", dayNumber: 1 },
      [{ gameYear: 4, editions: [{ id: "season-4-day-1" }] }], awards)).toEqual([]);
  });
  it.each([1,4,5,8,12])("publie le bon palmarès de la saison %s à J28", (gameYear) => {
    const id=`season-${gameYear}-day-28`;
    const target={id:'winner',gameYear};
    expect(selectCyclogazetteGalaAwards({id,dayNumber:28},[{gameYear,editions:[{id}]}],
      [target,{id:'previous',gameYear:gameYear-1}])).toEqual([target]);
    expect(selectCyclogazetteGalaAwards({id,dayNumber:27},[{gameYear,editions:[{id}]}],[target])).toEqual([]);
  });
});
