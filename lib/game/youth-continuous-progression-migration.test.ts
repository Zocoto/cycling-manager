import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260824130000_recalibrate_youth_progression.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("continuous youth progression migration", () => {
  it("keeps every SQL dollar-quoted block and the transaction balanced", () => {
    expect(migration.match(/\$\$/g)?.length ?? 0).toBeGreaterThan(0);
    expect((migration.match(/\$\$/g)?.length ?? 0) % 2).toBe(0);
    expect(migration.trimStart()).toMatch(/^begin;/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
  });

  it("removes the 70 and 76 cliffs from the active model", () => {
    expect(migration).toContain(
      "create or replace function public.get_youth_rating_progress_factor",
    );
    expect(migration).not.toContain("when p_projected_rating < 70 then 1");
    expect(migration).not.toContain("when p_projected_rating >= 76 then 0");
    expect(migration).toMatch(/greatest\(\s*0\.01,/);
    expect(migration).toContain("0.45");
  });

  it("makes talent central and considers the strength of the whole profile", () => {
    expect(migration).toContain(
      "create or replace function public.get_youth_talent_progress_multiplier",
    );
    expect(migration).toContain("0.50");
    expect(migration).toContain("1.05");
    expect(migration).toContain(
      "create or replace function public.get_youth_profile_load_factor",
    );
    expect(migration).toContain("v_profile_peak_rating");
    expect(migration).toContain("v_profile_average_rating");
  });

  it("gives manual sessions their calibrated advantage and deterministic variance", () => {
    expect(migration).toContain("when 'manual' then");
    expect(migration).toContain("0.75");
    expect(migration).toContain("0.25");
    expect(migration).toContain("get_youth_training_session_variance");
    expect(migration).toContain("md5(p_seed)");
    expect(migration).toContain("0.78");
    expect(migration).toContain("1.28");
  });

  it("also replaces the hidden podium thresholds with the continuous curve", () => {
    expect(migration).toContain(
      "create or replace function public.get_development_podium_rating_factor",
    );
    expect(migration).toContain(
      "power(public.get_youth_rating_progress_factor(p_projected_rating), 2)",
    );
  });
});
