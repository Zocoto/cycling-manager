import { describe, expect, it } from "vitest";

import {
  COUNTRY_MAP_COORDINATES,
  projectCountryCoordinate,
} from "./country-map-coordinates";

describe("projectCountryCoordinate", () => {
  it("projects geographic reference points onto the Equal Earth canvas", () => {
    expect(projectCountryCoordinate({ latitude: 0, longitude: 0 })).toEqual({
      x: 50,
      y: 50,
    });
    expect(projectCountryCoordinate({ latitude: 90, longitude: 0 }).y).toBeCloseTo(0, 8);
    expect(projectCountryCoordinate({ latitude: -90, longitude: 0 }).y).toBeCloseTo(100, 8);
    expect(projectCountryCoordinate({ latitude: 0, longitude: -180 }).x).toBeCloseTo(0, 8);
    expect(projectCountryCoordinate({ latitude: 0, longitude: 180 }).x).toBeCloseTo(100, 8);
  });

  it("places representative countries in their expected world regions", () => {
    const france = projectCountryCoordinate(COUNTRY_MAP_COORDINATES.FR);
    const unitedStates = projectCountryCoordinate(COUNTRY_MAP_COORDINATES.US);
    const brazil = projectCountryCoordinate(COUNTRY_MAP_COORDINATES.BR);
    const australia = projectCountryCoordinate(COUNTRY_MAP_COORDINATES.AU);

    expect(france.x).toBeGreaterThan(50);
    expect(france.y).toBeLessThan(25);
    expect(unitedStates.x).toBeLessThan(35);
    expect(unitedStates.y).toBeLessThan(40);
    expect(brazil.x).toBeLessThan(45);
    expect(brazil.y).toBeGreaterThan(50);
    expect(australia.x).toBeGreaterThan(80);
    expect(australia.y).toBeGreaterThan(60);
  });

  it("keeps every scouting country inside the map bounds", () => {
    for (const coordinate of Object.values(COUNTRY_MAP_COORDINATES)) {
      const point = projectCountryCoordinate(coordinate);
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(100);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(100);
    }
  });
});
