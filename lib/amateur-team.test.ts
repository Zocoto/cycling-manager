import { describe, expect, it } from "vitest";

import {
  DEFAULT_AMATEUR_JERSEY,
  hasDistinctJerseyColors,
  isAmateurJerseyPattern,
  normalizeHexColor,
} from "./amateur-team";

describe("amateur team jersey rules", () => {
  it("recognizes the supported patterns", () => {
    expect(isAmateurJerseyPattern("classic")).toBe(true);
    expect(isAmateurJerseyPattern("diagonal")).toBe(true);
    expect(isAmateurJerseyPattern("chevron")).toBe(true);
    expect(isAmateurJerseyPattern("checkerboard")).toBe(true);
    expect(isAmateurJerseyPattern("pinstripes")).toBe(true);
    expect(isAmateurJerseyPattern("custom-upload")).toBe(false);
  });

  it("normalizes valid hexadecimal colors", () => {
    expect(normalizeHexColor(" #a1b2c3 ")).toBe("#A1B2C3");
    expect(normalizeHexColor("red")).toBeNull();
    expect(normalizeHexColor("#FFF")).toBeNull();
  });

  it("requires at least two distinct colors", () => {
    expect(
      hasDistinctJerseyColors(DEFAULT_AMATEUR_JERSEY)
    ).toBe(true);

    expect(
      hasDistinctJerseyColors({
        pattern: "split",
        primaryColor: "#123456",
        secondaryColor: "#123456",
        accentColor: "#123456",
      })
    ).toBe(false);
  });
});
