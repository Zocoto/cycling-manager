import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260912170000_repair_el_presidente_trophy_entitlements.sql",
);
const migration = readFileSync(migrationPath, "utf8");

describe("El Presidente trophy entitlement repair", () => {
  it("replays the idempotent award for every eligible human president", () => {
    expect(migration).toContain("select distinct term.president_director_id");
    expect(migration).toContain("private.award_el_presidente_trophy(");
    expect(migration).toContain("director.auth_user_id is not null");
    expect(migration).toContain("public.alpha_bot_managers");
    expect(migration).not.toContain("avatar_key");
  });

  it("aborts instead of silently leaving an eligible president without the trophy", () => {
    expect(migration).toContain("left join public.sporting_director_trophies");
    expect(migration).toContain("trophy.trophy_key = 'el_presidente'");
    expect(migration).toContain("trophy.claimed_at is not null");
    expect(migration).toContain("raise exception");
  });
});
