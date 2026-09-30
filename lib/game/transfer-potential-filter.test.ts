import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const migration = read(
  "supabase/migrations/20260930110000_add_transfer_search_potential_filter.sql",
);
const service = read("services/transfer-market.ts");
const page = read("app/jeu/transferts/page.tsx");

describe("transfer rider potential filter", () => {
  it("filters the paginated server search without revealing hidden potential", () => {
    expect(migration).toContain("p_minimum_potential_steps integer default null");
    expect(migration).toContain("transfer_scouting_potential_maximum");
    expect(migration).toContain(
      "candidate.potential_scouting_maximum >= p_minimum_potential_steps",
    );
    expect(migration).toContain(
      "rider.potential_steps >= greatest(1, p_minimum_potential_steps - 2)",
    );
    expect(migration).toContain("v_level = 0 and v_seed % 4 = 0");
    expect(migration).toContain("count(*) over () as total_count");
  });

  it("wires the selected threshold from the page to the database RPC", () => {
    expect(page).toContain('name="potentielMin"');
    expect(page).toContain("Potentiel estimé min.");
    expect(page).toContain("minimumPotentialSteps: readPotentialSteps");
    expect(service).toContain("minimumPotentialSteps?: number");
    expect(service).toContain("p_minimum_potential_steps:");
  });
});
