import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260828211500_search_transfer_riders_by_contract.sql",
  ),
  "utf8",
);
const allContractsMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260828213000_search_transfer_riders_all_contracts.sql",
  ),
  "utf8",
);

describe("transfer rider search", () => {
  it("searches free and contracted riders on the database server", () => {
    expect(migration).toContain("public.search_transfer_riders");
    expect(migration).toContain("p_contract_status = 'free'");
    expect(migration).toContain("p_contract_status = 'contracted'");
    expect(migration).toContain("contract.status = 'active'");
  });

  it("filters before applying a bounded pagination window", () => {
    expect(migration).toContain("p_country_code");
    expect(migration).toContain("p_minimum_rating");
    expect(migration).toContain("public.transfer_scouting_maximum");
    expect(migration).toContain("selected_scouting_maximum >= p_minimum_rating");
    expect(migration).toContain("count(*) over () as total_count");
    expect(migration).toContain(
      "limit least(greatest(coalesce(p_limit, 48), 1), 60)",
    );
  });

  it("keeps the search private to the server and adds targeted indexes", () => {
    expect(migration).toContain("riders_transfer_search_idx");
    expect(migration).toContain("rider_season_ratings_transfer_search_idx");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });

  it("can mix free and contracted riders without a contract filter", () => {
    expect(allContractsMigration).toContain("p_contract_status text default 'all'");
    expect(allContractsMigration).toContain(
      "p_contract_status in ('all', 'free')",
    );
    expect(allContractsMigration).toContain(
      "p_contract_status in ('all', 'contracted')",
    );
  });
});
