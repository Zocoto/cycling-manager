import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ACHIEVEMENT_TROPHY_DEFINITIONS } from "@/lib/game/achievement-trophies";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260812170000_expand_modern_feature_objectives.sql",
);
const migration = readFileSync(migrationPath, "utf8");

describe("modern feature career objectives", () => {
  it("adds a broad pool backed by persisted gameplay metrics", () => {
    const objectiveRows = migration.match(/^\s*\('[a-z0-9_]+', 'secondary'/gm);

    expect(objectiveRows).toHaveLength(47);
    expect(migration).toContain("when 'cyclogazette_comments'");
    expect(migration).toContain("when 'submitted_post_race_interviews'");
    expect(migration).toContain("when 'active_roster_continents'");
    expect(migration).toContain("when 'successful_rnd_equipment_slots'");
    expect(migration).toContain("when 'fan_club_fleet_models'");
    expect(migration).toContain("when 'team_championship_crown_types'");
  });

  it("grants the four master trophies only after their objective is claimed", () => {
    expect(migration).toContain(
      "create trigger grant_objective_achievement_trophy",
    );
    expect(migration).toContain("after insert on public.game_objective_claims");
    expect(migration).toContain("'atlas_peloton'");
    expect(migration).toContain("'campus_de_pointe'");
    expect(migration).toContain("'alchimiste_carbone'");
    expect(migration).toContain("'triple_couronne_integrale'");
  });

  it("keeps the easter egg idempotent and tied to the authenticated DS", () => {
    expect(migration).toContain(
      "create or replace function public.discover_current_sporting_director_easter_egg()",
    );
    expect(migration).toContain("director.auth_user_id = auth.uid()");
    expect(migration).toContain(
      "on conflict (sporting_director_id, trophy_key) do nothing",
    );
    expect(migration).toContain("'virage_cache'");
  });

  it("ships a distinct simple mark for every dedicated trophy", () => {
    expect(
      Object.values(ACHIEVEMENT_TROPHY_DEFINITIONS).map(
        ({ visualVariant }) => visualVariant,
      ),
    ).toEqual([
      "astrolabe",
      "panorama",
      "apparatus",
      "regalia",
      "switchback",
    ]);
  });
});
