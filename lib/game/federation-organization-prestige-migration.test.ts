import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260909193000_wire_federation_organization_prestige.sql",
  ),
  "utf8",
);

describe("federation organization prestige migration", () => {
  it("uses a five-season rolling organization score capped at 100", () => {
    expect(migration).toContain("hosting_legacy_points between 0 and 100");
    expect(migration).toContain("v_game_year - 4");
    expect(migration).toContain("least(100, coalesce(sum(event.points), 0))");
  });

  it("credits the exact settled international-hosting prestige once", () => {
    expect(migration).toContain("award.prestige_gain::integer as points");
    expect(migration).toContain("award.status = 'settled'");
    expect(migration).not.toContain("least(10, award.prestige_gain)");
    expect(migration).toContain("and not exists (");
  });

  it("credits completed ordinary race stages with the portfolio scale", () => {
    expect(migration).toContain("race.competition_type = 'standard'");
    expect(migration).toContain("edition.status = 'completed'");
    expect(migration).toContain("count(stage.id)::integer * case category.code");
    expect(migration).toContain("when 'elite' then 10");
    expect(migration).toContain("when 'world' then 6");
    expect(migration).toContain("when 'continental' then 3");
  });
});
