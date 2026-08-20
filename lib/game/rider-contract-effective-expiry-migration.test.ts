import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260820160000_expose_effective_rider_contract_end.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("effective rider contract expiry migration", () => {
  it("keeps the current salary while exposing a planned renewal end", () => {
    expect(migration).toContain(
      "rider_contracts.salary_per_season::numeric",
    );
    expect(migration).toContain("left join lateral (");
    expect(migration).toContain("successor.status = 'planned'");
    expect(migration).toContain("successor.acquisition_type = 'renewal'");
    expect(migration).toContain(
      "effective_contract_end_season.id = coalesce(\n      renewal.end_season_id,\n      rider_contracts.end_season_id",
    );
  });

  it("preserves the current roster RPC contract and refreshes PostgREST", () => {
    expect(migration).toContain(
      "create or replace function public.get_current_team_roster()",
    );
    expect(migration).toContain("contract_end_season_name text");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });
});
