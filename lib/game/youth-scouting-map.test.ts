import { describe, expect, it } from "vitest";
import { COUNTRY_MAP_COORDINATES, projectCountryCoordinate } from "@/data/country-map-coordinates";
import { getScoutingCountrySuggestions, getScoutingMapPoint, isScoutingMapPointVisible, SCOUTING_MAP_VIEWS, type ScoutingMapView } from "./youth-scouting-map";

const countries = [
  { name: "Cameroun", code: "CM" }, { name: "Arménie", code: "AM" },
  { name: "France", code: "FR" }, { name: "Côte d’Ivoire", code: "CI" },
  { name: "États-Unis", code: "US" }, { name: "Afrique du Sud", code: "ZA" },
];
describe("scouting map suggestions", () => {
  it("matches accents, casing, spaces and country codes", () => {
    expect(getScoutingCountrySuggestions(countries, " ARMENIE ")[0].code).toBe("AM");
    expect(getScoutingCountrySuggestions(countries, "arm")[0].code).toBe("AM");
    expect(getScoutingCountrySuggestions(countries, "cote d'ivoire")[0].code).toBe("CI");
    expect(getScoutingCountrySuggestions(countries, "etats")[0].code).toBe("US");
    expect(getScoutingCountrySuggestions(countries, "us")[0].code).toBe("US");
  });
  it("prioritizes exact codes then name prefixes before substrings", () => {
    expect(getScoutingCountrySuggestions(countries, "am").map((country) => country.code)).toEqual(["AM", "CM"]);
    expect(getScoutingCountrySuggestions(countries, "fr").map((country) => country.code)).toEqual(["FR", "ZA"]);
  });
  it("has no initial bottom-list substitute, handles no matches, and limits suggestions", () => {
    expect(getScoutingCountrySuggestions(countries, "  ")).toEqual([]);
    expect(getScoutingCountrySuggestions(countries, "no-match")).toEqual([]);
    expect(getScoutingCountrySuggestions(countries, "a", 2)).toHaveLength(2);
  });
  it("never mutates the supplied countries", () => {
    const original = [...countries];
    getScoutingCountrySuggestions(Object.freeze(original), "a");
    expect(original).toEqual(countries);
  });
});
describe("lightweight scouting camera", () => {
  it("keeps world coordinates unchanged", () => {
    for (const coordinate of Object.values(COUNTRY_MAP_COORDINATES))
      expect(getScoutingMapPoint(coordinate, "world")).toEqual(projectCountryCoordinate(coordinate));
  });
  it("uses a consistent, undistorted crop for markers and the existing map", () => {
    for (const view of Object.keys(SCOUTING_MAP_VIEWS) as ScoutingMapView[]) {
      const frame = SCOUTING_MAP_VIEWS[view];
      expect(frame.size).toBeGreaterThan(0);
      expect(frame.left + frame.size).toBeLessThanOrEqual(100);
      expect(frame.top + frame.size).toBeLessThanOrEqual(100);
      const point = getScoutingMapPoint(COUNTRY_MAP_COORDINATES.FR, view);
      const world = projectCountryCoordinate(COUNTRY_MAP_COORDINATES.FR);
      expect(point.x * frame.size / 100 + frame.left).toBeCloseTo(world.x, 8);
      expect(point.y * frame.size / 100 + frame.top).toBeCloseTo(world.y, 8);
    }
  });
  it.each([
    ["europe", "FR"], ["africa", "ZA"], ["asia", "CN"], ["north_america", "US"],
    ["south_america", "AR"], ["oceania", "AU"], ["oceania", "NZ"], ["oceania", "FJ"],
  ] as const)("includes %s representative %s", (view, code) => {
    expect(isScoutingMapPointVisible(getScoutingMapPoint(COUNTRY_MAP_COORDINATES[code], view))).toBe(true);
  });
  it("excludes off-screen markers from the camera without excluding them from search", () => {
    expect(isScoutingMapPointVisible(getScoutingMapPoint(COUNTRY_MAP_COORDINATES.AU, "europe"))).toBe(false);
    expect(isScoutingMapPointVisible(getScoutingMapPoint(COUNTRY_MAP_COORDINATES.AM, "europe"))).toBe(true);
  });
});
