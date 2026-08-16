import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260816160000_create_regional_races.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

describe("regional races migration", () => {
  it("crée sept courses dans chacun des cinq continents", () => {
    expect(migration).toContain("exactement 35 courses");
    expect(migration).toContain(") <> 7 then");
    expect(migration.match(/'africa', \d+/g)).toHaveLength(7);
    expect(migration.match(/'america', \d+/g)).toHaveLength(7);
    expect(migration.match(/'asia', \d+/g)).toHaveLength(7);
    expect(migration.match(/'europe', \d+/g)).toHaveLength(7);
    expect(migration.match(/'oceania', \d+/g)).toHaveLength(7);
    expect(migration).toContain(
      "seed.day_number <= coalesce(season.current_day_number, 0)",
    );
  });

  it("verrouille l'inscription aux amateurs du même continent", () => {
    expect(migration).toContain(
      "contract.role = 'principal'\n        and contract.status = 'active'",
    );
    expect(migration).toContain(
      "v_team_continent_code is distinct from v_race_continent_code",
    );
    expect(migration).toContain("before insert on public.race_registrations");
    expect(migration).toContain(
      "before insert on public.stage_reconnaissances",
    );
    expect(migration).toContain(
      "withdraw_team_from_regional_races_after_sponsoring",
    );
  });
});
