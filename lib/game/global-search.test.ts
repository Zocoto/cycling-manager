import { describe, expect, it } from "vitest";

import {
  getGlobalSearchResultHref,
  groupGlobalSearchResults,
  normalizeGlobalSearchQuery,
  type GlobalSearchResult,
} from "./global-search";

const baseResult: GlobalSearchResult = {
  result_type: "sporting_director",
  entity_id: "11111111-1111-1111-1111-111111111111",
  public_identifier: "Paul Roue",
  display_name: "Paul Roue",
  avatar_key: null,
  reputation_points: 12,
  country_code: "FR",
  country_name: "France",
  team_name: null,
  team_id: null,
  division_code: null,
  division_name: null,
  sponsor_name: null,
  sporting_director_username: null,
  sporting_director_name: null,
  sporting_director_count: null,
  team_count: null,
};

describe("normalizeGlobalSearchQuery", () => {
  it("nettoie les espaces sans modifier la casse saisie", () => {
    expect(
      normalizeGlobalSearchQuery("  Vélo   Club  ")
    ).toBe("Vélo Club");
  });

  it("utilise la première valeur d’un paramètre multiple", () => {
    expect(
      normalizeGlobalSearchQuery(["France", "Belgique"])
    ).toBe("France");
  });
});

describe("groupGlobalSearchResults", () => {
  it("regroupe les résultats par catégorie", () => {
    const team: GlobalSearchResult = {
      ...baseResult,
      result_type: "team",
      public_identifier:
        "22222222-2222-2222-2222-222222222222",
    };
    const country: GlobalSearchResult = {
      ...baseResult,
      result_type: "country",
      public_identifier: "fr",
    };

    const groups = groupGlobalSearchResults([
      team,
      baseResult,
      country,
    ]);

    expect(groups.sportingDirectors).toEqual([baseResult]);
    expect(groups.teams).toEqual([team]);
    expect(groups.countries).toEqual([country]);
  });
});

describe("getGlobalSearchResultHref", () => {
  it("encode l’identifiant public d’un Directeur Sportif", () => {
    expect(getGlobalSearchResultHref(baseResult)).toBe(
      "/jeu/directeurs-sportifs/Paul%20Roue"
    );
  });
});
