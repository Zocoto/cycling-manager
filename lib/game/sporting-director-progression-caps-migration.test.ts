import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260821220000_cap_sporting_director_progression.sql",
  ),
  "utf8",
);

describe("sporting director progression caps migration", () => {
  it("normalizes existing values before adding hard database limits", () => {
    expect(migration).toContain(
      "reputation_points = least(reputation_points, 1000::numeric)",
    );
    expect(migration).toContain(
      "experience_points = least(experience_points, 63700)",
    );
    expect(migration).toContain("check (reputation_points <= 1000)");
    expect(migration).toContain("check (experience_points <= 63700)");
    expect(migration).toContain(
      "PLAFONDS DS | Reputations ramenees a 1000:",
    );
  });

  it("clamps future gains centrally while leaving lower values untouched", () => {
    expect(migration).toContain(
      "before insert or update of reputation_points, experience_points",
    );
    expect(migration).toContain(
      "new.reputation_points := least(new.reputation_points, 1000::numeric)",
    );
    expect(migration).toContain(
      "new.experience_points := least(new.experience_points, 63700)",
    );
    expect(migration).not.toContain(
      "greatest(old.reputation_points, new.reputation_points)",
    );
  });

  it("caps the shared database level calculation at level 50", () => {
    expect(migration).toContain("v_experience integer := least(");
    expect(migration).toMatch(/while v_level < 50\s+and v_experience/);
    expect(migration).toContain(
      "Calcule le niveau du Directeur Sportif, plafonné au niveau 50.",
    );
  });
});
