import { describe, expect, it } from "vitest";

import { getFederationNationTheme } from "@/lib/game/federation-nation-theme";

describe("federation nation theme", () => {
  it("uses recognizable national colors", () => {
    expect(getFederationNationTheme("BE")).toMatchObject({
      primary: "#181716",
      secondary: "#C92A32",
      accent: "#F6D02F",
    });
    expect(getFederationNationTheme("fr").accent).toBe("#D7283F");
  });

  it("lets a composed national jersey drive the federation palette", () => {
    expect(
      getFederationNationTheme("BE", {
        schemaVersion: 2,
        baseColor: "#336699",
        elements: [],
      }).secondary,
    ).not.toBe("#C92A32");
  });
});
