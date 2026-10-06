import { describe, expect, it } from "vitest";
import { splitPcmGalaGroups } from "./pcm-gala-groups";

describe("groupes indépendants du gala sans plafond d'inscription", () => {
  it.each([0, 1, 20, 21, 30, 40, 41, 150, 1001])("répartit %i équipes sans perte ni doublon", (count) => {
    const teams = Array.from({ length: count }, (_, index) => index);
    const groups = splitPcmGalaGroups(teams);
    expect(groups).toHaveLength(Math.max(1, Math.ceil(count / 20)));
    expect(groups.every((group) => group.length <= 20)).toBe(true);
    expect(Math.max(...groups.map((group) => group.length)) - Math.min(...groups.map((group) => group.length))).toBeLessThanOrEqual(1);
    expect(groups.flat().sort((left, right) => left - right)).toEqual(teams);
    expect(splitPcmGalaGroups(teams)).toEqual(groups);
  });
  it("équilibre 21 et 30 équipes en deux simulations", () => {
    expect(splitPcmGalaGroups(Array.from({ length: 21 })).map((group) => group.length)).toEqual([11, 10]);
    expect(splitPcmGalaGroups(Array.from({ length: 30 })).map((group) => group.length)).toEqual([15, 15]);
  });
});
