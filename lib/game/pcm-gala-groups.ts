import { SEASON_FINALE_GALA_TEAMS_PER_GROUP } from "./season-finale-gala";

/** Répartition reproductible et équilibrée en nombre, sans exclure une équipe. */
export function splitPcmGalaGroups<T>(teams: readonly T[]): T[][] {
  const count = Math.max(1, Math.ceil(teams.length / SEASON_FINALE_GALA_TEAMS_PER_GROUP));
  const groups: T[][] = Array.from({ length: count }, () => []);
  teams.forEach((team, index) => groups[index % count].push(team));
  return groups;
}
