import { projectCountryCoordinate, type CountryMapCoordinate } from "@/data/country-map-coordinates";

/** Camera crops of the existing planisphere, not a second geographic dataset. */
export const SCOUTING_MAP_VIEWS = {
  world: { label: "Monde", left: 0, top: 0, size: 100 },
  europe: { label: "Europe", left: 37, top: 0, size: 34 },
  africa: { label: "Afrique", left: 32, top: 24, size: 53 },
  asia: { label: "Asie", left: 42, top: 3, size: 58 },
  north_america: { label: "Amérique du Nord", left: 0, top: 0, size: 55 },
  south_america: { label: "Amérique du Sud", left: 10, top: 40, size: 55 },
  oceania: { label: "Océanie", left: 63, top: 45, size: 37 },
} as const;
export type ScoutingMapView = keyof typeof SCOUTING_MAP_VIEWS;

export function getScoutingMapPoint(coordinate: CountryMapCoordinate, view: ScoutingMapView) {
  const point = projectCountryCoordinate(coordinate);
  if (view === "world") return point;
  const frame = SCOUTING_MAP_VIEWS[view];
  return { x: (point.x - frame.left) * 100 / frame.size, y: (point.y - frame.top) * 100 / frame.size };
}

export function isScoutingMapPointVisible(point: { x: number; y: number }) {
  return point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100;
}

function normalizeCountrySearch(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ").toLocaleLowerCase("fr").trim();
}

export function getScoutingCountrySuggestions<T extends { name: string; code: string }>(
  countries: readonly T[], search: string, limit = 12,
): T[] {
  const query = normalizeCountrySearch(search);
  if (!query) return [];
  return countries.map((country) => {
    const name = normalizeCountrySearch(country.name);
    const code = normalizeCountrySearch(country.code);
    const rank = code === query || name === query ? 0 : name.startsWith(query) ? 1
      : name.includes(query) || code.startsWith(query) ? 2 : 3;
    return { country, rank };
  }).filter((entry) => entry.rank < 3)
    .sort((a, b) => a.rank - b.rank || a.country.name.localeCompare(b.country.name, "fr"))
    .slice(0, limit).map((entry) => entry.country);
}
