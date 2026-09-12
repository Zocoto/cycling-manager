import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260912143000_award_el_presidente_avatar_skin.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("El Presidente avatar skin migration", () => {
  it("awards the distinction automatically to every new human president", () => {
    expect(migration).toContain("private.award_el_presidente_trophy");
    expect(migration).toContain("director.auth_user_id is not null");
    expect(migration).toContain("from public.alpha_bot_managers as bot");
    expect(migration).toContain("award_el_presidente_after_term_change");
    expect(migration).toContain("after insert or update of president_director_id");
    expect(migration).toContain("on conflict (sporting_director_id, trophy_key) do update");
  });

  it("backfills presidents in office during the active season", () => {
    expect(migration).toContain("join public.seasons as season");
    expect(migration).toContain("season.status = 'active'");
    expect(migration).toContain(
      "season.game_year between term.start_game_year and term.end_game_year",
    );
    expect(migration).toContain(
      "perform private.award_el_presidente_trophy(\n      v_president.president_director_id",
    );
  });

  it("protects the exclusive outfit in the database and announces the unlock", () => {
    expect(migration).toContain("private.validate_el_presidente_avatar_outfit");
    expect(migration).toContain("v_outfit_key <> 'el-presidente'");
    expect(migration).toContain("'.',\n    14");
    expect(migration).toContain("trophy.trophy_key = 'el_presidente'");
    expect(migration).toContain("when 'el_presidente' then 'El Presidente'");
    expect(migration).toContain(
      "la tenue officielle El Presidente dans l’éditeur d’avatar",
    );
  });
});
