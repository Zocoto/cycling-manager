import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PublicCountryPresidentCard } from "@/components/game/public-country-president-card";
import type { GlobalSearchResult } from "@/lib/game/global-search";

const president: GlobalSearchResult = {
  result_type: "sporting_director",
  entity_id: "director-1",
  public_identifier: "ujik",
  display_name: "Ujik",
  avatar_key: "classic",
  avatar_frame_key: null,
  reputation_points: 42,
  country_code: "BE",
  country_name: "Belgique",
  team_name: "Hexa Bâtiment",
  team_id: "team-1",
  division_code: "world_tour",
  division_name: "World Tour",
  is_professional: true,
  sponsor_name: null,
  sporting_director_username: null,
  sporting_director_name: null,
  sporting_director_count: null,
  team_count: null,
};

describe("PublicCountryPresidentCard", () => {
  it("présente le président avec un lien vers son profil public", () => {
    const markup = renderToStaticMarkup(
      <PublicCountryPresidentCard president={president} />,
    );

    expect(markup).toContain("Président de la fédération");
    expect(markup).toContain("Ujik");
    expect(markup).toContain("@ujik · Hexa Bâtiment");
    expect(markup).toContain('/jeu/directeurs-sportifs/ujik');
  });

  it("signale sobrement la gestion automatique sans président élu", () => {
    const markup = renderToStaticMarkup(
      <PublicCountryPresidentCard president={null} />,
    );

    expect(markup).toContain("Présidence fédérale");
    expect(markup).toContain("Gestion automatique");
    expect(markup).toContain("Aucun président élu actuellement");
  });
});
