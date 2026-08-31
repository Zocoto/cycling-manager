import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260831100000_add_cyclogazette_daily_games.sql",
  ),
  "utf8",
);

describe("Cyclogazette daily-games migration", () => {
  it("stores only successful completions with bounded indexed reads", () => {
    expect(migration).toContain("create table public.cyclogazette_game_completions");
    expect(migration).toContain("cyclogazette_game_completions_once");
    expect(migration).toContain("cyclogazette_game_completions_edition_idx");
    expect(migration).toContain("limit 24");
    expect(migration).not.toContain("failed_attempt");
  });

  it("credits one atomic reward and protects completion from direct clients", () => {
    expect(migration).toContain("v_game_reward numeric(14, 2) := 1000");
    expect(migration).toContain("for update of team_season");
    expect(migration).toContain("on conflict (edition_id, sporting_director_id, game_type) do nothing");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("from public, anon, authenticated");
  });

  it("adds six objectives and the hidden ten-edition trophy", () => {
    expect(migration.match(/'cyclogazette_sudoku_[0-9]+'/g)).toHaveLength(3);
    expect(migration.match(/'cyclogazette_crossword_[0-9]+'/g)).toHaveLength(3);
    expect(migration).toContain("'joueur_inveter'");
    expect(migration).toContain("count(distinct completion.game_type) = 2");
    expect(migration).toContain("v_context.issue_number - 9");
    expect(migration).toContain("'poker-chips'");
  });
});
