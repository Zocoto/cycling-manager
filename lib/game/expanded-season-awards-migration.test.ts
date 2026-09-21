import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260921120000_expand_season_awards.sql",
  ),
  "utf8",
);

describe("expanded season awards migration", () => {
  it("déclare toutes les nouvelles distinctions et conserve la génération historique", () => {
    for (const key of [
      "injury_rider",
      "injury_director",
      "red_lantern_rider",
      "red_lantern_director",
      "negotiator",
      "sudoku_master",
      "crossword_master",
      "builder",
      "mixed_zone",
      "chatterbox",
      "youth_developer",
      "junior_rider_of_year",
      "junior_director_of_year",
      "paddock_favorite",
    ]) {
      expect(migration).toContain(`'${key}'`);
    }

    expect(migration).toContain(
      "create_core_season_awards_before_expansion(p_season_id)",
    );
    expect(migration).toContain("on conflict (season_id, award_key) do nothing");
  });

  it("s'appuie sur les marqueurs persistés et exclut les bots des awards sociaux", () => {
    expect(migration).toContain("public.rider_injuries");
    expect(migration).toContain("public.direct_transfer_offers");
    expect(migration).toContain("public.cyclogazette_game_completions");
    expect(migration).toContain("public.infrastructure_projects");
    expect(migration).toContain("public.post_race_interviews");
    expect(migration).toContain("public.pre_race_press_conferences");
    expect(migration).toContain("public.global_chat_messages");
    expect(migration).toContain("public.global_chat_message_reactions");
    expect(migration).toContain("public.development_ranking_entries");
    expect(migration).toContain("public.alpha_bot_managers");
  });

  it("ne double pas une blessure présente dans deux niveaux de résultats", () => {
    expect(migration).toContain("select distinct on (injury.id)");
    expect(migration).toContain("sum(recovery_days)::integer");
    expect(migration).toContain("count(distinct rider_id)::integer");
  });
});
