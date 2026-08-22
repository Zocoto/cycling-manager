import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260822130000_version_rider_avatar_generation.sql",
);

describe("migration des portraits coureurs v2", () => {
  const migration = readFileSync(migrationPath, "utf8");

  it("réserve les graines négatives aux nouveaux coureurs", () => {
    expect(migration).toContain(
      "new.avatar_seed := -nextval('public.rider_avatar_seed_seq')",
    );
    expect(migration).toContain(
      "drop constraint if exists riders_avatar_seed_non_negative",
    );
  });

  it("ne retouche aucun portrait déjà attribué", () => {
    expect(migration).not.toMatch(/update\s+public\.riders/i);
    expect(migration).not.toMatch(/set\s+avatar_seed\s*=/i);
  });
});
