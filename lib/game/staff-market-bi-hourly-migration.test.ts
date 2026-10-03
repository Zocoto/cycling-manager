import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20261003100000_create_bi_hourly_staff_market_waves.sql",
);

describe("staff market bi-hourly migration", () => {
  const source = readFileSync(migrationPath, "utf8");

  it("autorise douze vagues de cinq jusqu’à soixante profils", () => {
    expect(source).toContain("staff_count between 0 and 60");
    expect(source).toContain("mod(staff_count, 5) = 0");
    expect(source).toContain("daily_slot between 1 and 60");
    expect(source).toContain("p_wave_index not between 0 and 11");
    expect(source).toContain("jsonb_array_length(p_candidates) <> 5");
  });

  it("sérialise et rend chaque vague idempotente", () => {
    expect(source).toContain("for update");
    expect(source).toContain("v_existing_count >= v_expected_after");
    expect(source).toContain("v_existing_count <> v_expected_before");
    expect(source).toContain("return 0;");
    expect(source).toContain("return 5;");
  });

  it("borne les verrous et l’exécution de la migration", () => {
    expect(source).toContain("set local lock_timeout = '5s'");
    expect(source).toContain("set local statement_timeout = '30s'");
  });
});
