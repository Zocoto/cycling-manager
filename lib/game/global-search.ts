export const GLOBAL_SEARCH_MIN_LENGTH = 2;
export const GLOBAL_SEARCH_MAX_LENGTH = 80;

export type GlobalSearchResultType =
  | "sporting_director"
  | "team"
  | "country";

export type GlobalSearchResult = {
  result_type: GlobalSearchResultType;
  entity_id: string;
  public_identifier: string;
  display_name: string;
  avatar_key: string | null;
  reputation_points: number | null;
  country_code: string;
  country_name: string;
  team_name: string | null;
  team_id: string | null;
  division_code: string | null;
  division_name: string | null;
  sponsor_name: string | null;
  sporting_director_username: string | null;
  sporting_director_name: string | null;
  sporting_director_count: number | null;
  team_count: number | null;
};

export type GroupedGlobalSearchResults = {
  sportingDirectors: GlobalSearchResult[];
  teams: GlobalSearchResult[];
  countries: GlobalSearchResult[];
};

export function normalizeGlobalSearchQuery(
  value: string | string[] | undefined
): string {
  const query = Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";

  return query
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, GLOBAL_SEARCH_MAX_LENGTH);
}

export function groupGlobalSearchResults(
  results: GlobalSearchResult[]
): GroupedGlobalSearchResults {
  return results.reduce<GroupedGlobalSearchResults>(
    (groups, result) => {
      if (result.result_type === "sporting_director") {
        groups.sportingDirectors.push(result);
      } else if (result.result_type === "team") {
        groups.teams.push(result);
      } else if (result.result_type === "country") {
        groups.countries.push(result);
      }

      return groups;
    },
    {
      sportingDirectors: [],
      teams: [],
      countries: [],
    }
  );
}

export function getGlobalSearchResultHref(
  result: GlobalSearchResult
): string {
  const identifier = encodeURIComponent(
    result.public_identifier
  );

  if (result.result_type === "sporting_director") {
    return `/jeu/directeurs-sportifs/${identifier}`;
  }

  if (result.result_type === "team") {
    return `/jeu/equipes/${identifier}`;
  }

  return `/jeu/nations/${identifier.toLowerCase()}`;
}
