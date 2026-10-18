import { describe, expect, it } from "vitest";
import { paginateUciRiders } from "./uci-rankings";

describe("pagination du tableau individuel UCI", () => {
  const entries = Array.from({ length: 1232 }, (_, i) => ({ rank: i + 1 }));
  it("borne les portraits affichés tout en conservant les vrais rangs", () => {
    const first = paginateUciRiders(entries, 1);
    expect(first.entries).toHaveLength(100);
    expect(first).toMatchObject({ page: 1, pageCount: 13, totalEntries: 1232 });
    expect(paginateUciRiders(entries, 2).entries[0].rank).toBe(101);
    expect(paginateUciRiders(entries, 13).entries).toEqual(entries.slice(1200));
  });
  it.each([0, -1, NaN, Infinity])("revient à la première page pour %s", requested => {
    expect(paginateUciRiders(entries, requested).page).toBe(1);
  });
  it("borne une page trop élevée et gère un classement vide", () => {
    expect(paginateUciRiders(entries, 100).page).toBe(13);
    expect(paginateUciRiders([], 100)).toMatchObject({ entries: [], page: 1, pageCount: 1, totalEntries: 0 });
  });
});
