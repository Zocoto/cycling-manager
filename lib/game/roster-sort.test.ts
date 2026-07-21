import { describe, expect, it } from "vitest";

import {
  compareRosterSortValues,
  getNextRosterSortDirection,
  parseRosterSortDirection,
  parseRosterSortKey,
  sortRosterItems,
} from "./roster-sort";

describe("roster sorting", () => {
  it("valide uniquement les colonnes autorisées", () => {
    expect(parseRosterSortKey("sprint")).toBe("sprint");
    expect(parseRosterSortKey("mountain")).toBe("mountain");
    expect(parseRosterSortKey("unknown")).toBeNull();
  });

  it("affiche les meilleures notes en premier au premier clic", () => {
    expect(parseRosterSortDirection(undefined, "sprint")).toBe("desc");
    expect(parseRosterSortDirection(undefined, "average")).toBe("desc");
    expect(parseRosterSortDirection(undefined, "rider")).toBe("asc");
  });

  it("inverse la direction de la colonne active", () => {
    expect(
      getNextRosterSortDirection({
        sortKey: "sprint",
        currentSortKey: "sprint",
        currentDirection: "desc",
      })
    ).toBe("asc");

    expect(
      getNextRosterSortDirection({
        sortKey: "mountain",
        currentSortKey: "sprint",
        currentDirection: "asc",
      })
    ).toBe("desc");
  });

  it("compare les nombres et les libellés dans les deux directions", () => {
    expect(compareRosterSortValues(82, 75, "desc")).toBeLessThan(0);
    expect(compareRosterSortValues(82, 75, "asc")).toBeGreaterThan(0);
    expect(compareRosterSortValues("Émile", "Fabien", "asc")).toBeLessThan(0);
  });

  it("trie sans modifier la liste reçue et départage par le nom", () => {
    const riders = [
      { name: "Zoé", sprint: 82 },
      { name: "Alice", sprint: 82 },
      { name: "Bruno", sprint: 76 },
    ];

    const sorted = sortRosterItems({
      items: riders,
      direction: "desc",
      getValue: (rider) => rider.sprint,
      getTieBreaker: (rider) => rider.name,
    });

    expect(sorted.map((rider) => rider.name)).toEqual([
      "Alice",
      "Zoé",
      "Bruno",
    ]);
    expect(riders.map((rider) => rider.name)).toEqual([
      "Zoé",
      "Alice",
      "Bruno",
    ]);
  });
});
