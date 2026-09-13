import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260913150000_version_rider_avatar_generation_v3.sql",
);
const youthServicePath = path.join(
  process.cwd(),
  "services",
  "youth-development.ts",
);

describe("migration des portraits coureurs v3", () => {
  const migration = readFileSync(migrationPath, "utf8");
  const youthService = readFileSync(youthServicePath, "utf8");

  it("attribue le nouvel espace de graines uniquement aux futurs pros", () => {
    expect(migration).toContain(
      "new.avatar_seed := -(1000000000000::bigint + nextval('public.rider_avatar_seed_seq'))",
    );
    expect(migration).not.toMatch(/update\s+public\.riders/i);
    expect(migration).not.toMatch(/update\s+public\.youth_/i);
  });

  it("utilise aussi la v3 pour les futurs juniors détectés", () => {
    expect(youthService).toContain(
      "avatar_seed: createThirdGenerationRiderAvatarSeed(identity.avatar_seed)",
    );
    expect(youthService).not.toContain("avatar_seed: `-${identity.avatar_seed}`");
  });
});
