export type QuadrennialChampionshipDiscipline = "road" | "time_trial";

export const QUADRENNIAL_CHAMPION_JERSEY = "/images/quadrennial-games/champion-jersey-v1.webp";
export const QUADRENNIAL_GAMES_EMBLEM = "/images/quadrennial-games/emblem-v1.webp";

export function parseQuadrennialChampionshipType(value: string): QuadrennialChampionshipDiscipline | null {
  if (value === "quadrennial_road") return "road";
  if (value === "quadrennial_time_trial") return "time_trial";
  return null;
}

export function isQuadrennialGamesEdition(edition: { competitionType: string; name: string }) {
  return edition.competitionType === "nations_cup" && /^Jeux quadriennaux(?:\s|$)/u.test(edition.name);
}

export function getQuadrennialChampionLabel(discipline: QuadrennialChampionshipDiscipline) {
  return discipline === "time_trial"
    ? "Champion des Jeux quadriennaux · CLM"
    : "Champion des Jeux quadriennaux · Route";
}
