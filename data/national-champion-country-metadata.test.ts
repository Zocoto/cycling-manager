import { describe, expect, it } from "vitest";

import { NATIONAL_CHAMPION_COUNTRY_COLORS } from "./national-champion-country-metadata";

describe("métadonnées des maillots de champions nationaux", () => {
  it("couvre les 173 nationalités sportives actives", () => {
    expect(Object.keys(NATIONAL_CHAMPION_COUNTRY_COLORS)).toHaveLength(173);
  });

  it("renseigne trois couleurs valides pour chaque pays", () => {
    for (const colors of Object.values(NATIONAL_CHAMPION_COUNTRY_COLORS)) {
      expect(colors).toHaveLength(3);
      expect(colors.every((color) => /^#[0-9A-F]{6}$/.test(color))).toBe(true);
    }
  });
});
