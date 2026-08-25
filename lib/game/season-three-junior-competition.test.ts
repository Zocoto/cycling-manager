import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = read(
  "supabase/migrations/20260825140000_add_season_three_junior_competition.sql",
);
const developmentService = read("services/development-team.ts");
const developmentPage = read("app/jeu/centre-de-formation/page.tsx");
const developmentPanel = read("components/game/development-team-panel.tsx");
const juniorRankings = read("services/junior-rankings.ts");

describe("circuit junior de la saison 3", () => {
  it("préserve le moteur historique des saisons 1 et 2", () => {
    expect(migration).toContain(
      "ensure_development_race_calendar_pre_season_three",
    );
    expect(migration).toContain("if v_game_year < 3 then");
    expect(migration).toContain(
      "return public.ensure_development_race_calendar_pre_season_three(p_season_id)",
    );
  });

  it("applique les barèmes à l’écriture et conserve des adversaires persistants", () => {
    expect(migration).toContain("create table public.development_virtual_riders");
    expect(migration).toContain("prepare_season_three_development_result");
    expect(migration).toContain("array[20,17,15,13,11,10,9,8,7,6,5,4,3,2,1]");
    expect(migration).toContain("array[6,5,4,3,2,1]");
    expect(migration).toContain("'piccolo-giro-juniores'");
  });

  it("pré-agrège les trois classements et limite les nations à cinq juniors", () => {
    expect(migration).toContain("create table public.development_ranking_entries");
    expect(migration).toContain("public.refresh_development_rankings");
    expect(migration).toContain("ranked.nation_rank <= 5");
    expect(juniorRankings).toContain("PAGE_SIZE = 50");
    expect(juniorRankings).toContain('.range(offset, offset + PAGE_SIZE - 1)');
  });

  it("ouvre les CN juniors à 16 ans et comble les petits champs professionnels", () => {
    expect(migration).toContain("v_game_year - v_birth_game_year < 16");
    expect(migration).toContain("sync_junior_pro_national_fallback");
    expect(migration).toContain("then 4 else 8 end");
    expect(migration).toContain("rider.status in ('active', 'free_agent', 'academy')");
  });

  it("attribue les titres, maillots et sélections mondiales automatiques", () => {
    expect(migration).toContain("create table public.junior_championship_titles");
    expect(migration).toContain("prepare_development_world_selections");
    expect(developmentPanel).toContain("createWorldChampionRiderJersey");
    expect(developmentPanel).toContain("createNationalChampionRiderJersey");
  });

  it("ne charge que la rubrique demandée par le joueur", () => {
    expect(developmentPage).toContain('if (activeTab !== "development")');
    expect(developmentPage).toContain("activeDevelopmentView,");
    expect(developmentService).toContain('view === "resultats"');
    expect(developmentPanel).toContain("fi fi-${race.countryCode.toLowerCase()}");
  });
});

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}
