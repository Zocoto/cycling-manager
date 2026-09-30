import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260930200000_contextualize_rider_result_morale.sql",
  ),
  "utf8",
);

describe("contextual rider result morale migration", () => {
  it("combines race prestige, UCI rank, finish and expectation scope", () => {
    expect(migration).toContain("get_contextual_result_morale_delta");
    expect(migration).toContain("category.code as category_code");
    expect(migration).toContain("summary.uci_rank");
    expect(migration).toContain("p_scope not in ('stage', 'one_day', 'gc')");
    expect(migration).toContain("expectationModel', 'category-uci-v1'");
  });

  it("keeps minor wins neutral for stars and rewards elite wins", () => {
    expect(migration).toContain(
      "'national', 1, 1, 'finished', 'one_day'",
    );
    expect(migration).toContain(
      "'elite', 1, 1, 'finished', 'one_day'",
    );
    expect(migration).toContain(
      "le numero 1 UCI ne doit rien gagner sur une victoire nationale",
    );
  });

  it("rewards outsiders for honourable places without punishing them as favourites", () => {
    expect(migration).toContain(
      "'national', 350, 10, 'finished', 'one_day'",
    );
    expect(migration).toContain(
      "'elite', 180, 80, 'finished', 'one_day'",
    );
    expect(migration).toContain("Place d’honneur encourageante");
  });

  it("penalizes favourites only once at the end of a stage race", () => {
    expect(migration).toContain("if p_scope = 'stage' then");
    expect(migration).toContain("v_bad_threshold");
    expect(migration).toContain("Résultat en dessous des attentes d’un favori");
    expect(migration).toContain("Classement général en dessous des attentes");
  });

  it("shares team victories with modest teammates", () => {
    expect(migration).toContain("get_teammate_win_morale_delta");
    expect(migration).toContain("'team-win:' || new.stage_id::text");
    expect(migration).toContain("'team-gc-win:' || new.race_edition_id::text");
    expect(migration).toContain("renforce la confiance du collectif");
    expect(migration).toContain("récompense le travail du collectif");
  });

  it("does not let a favourite-race bonus bypass the prestige threshold", () => {
    expect(migration).toContain("get_favorite_race_morale_delta");
    expect(migration).toContain("return case when v_prestige >= v_tier then 1 else 0 end");
  });
});
