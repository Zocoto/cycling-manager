import { describe, expect, it } from "vitest";
import { getRacePrestigeDefinition, RACE_PRESTIGE_DEFINITIONS } from "./race-prestige";

describe("S5 race prestige", () => {
  it("offers three cobbled and three hilly Monuments with distinct trophies", () => {
    expect(RACE_PRESTIGE_DEFINITIONS.filter((r) => r.kind === "monument_cobbled")).toHaveLength(3);
    expect(RACE_PRESTIGE_DEFINITIONS.filter((r) => r.kind === "monument_hilly")).toHaveLength(3);
    expect(new Set(RACE_PRESTIGE_DEFINITIONS.map((r) => r.trophyVisualVariant)).size).toBe(9);
    expect(getRacePrestigeDefinition("doyenne-des-collines")).toMatchObject({
      kind: "monument_hilly", trophyTitle: "Laurier des Collines", trophyVisualVariant: "hills_laurel",
    });
  });
});
