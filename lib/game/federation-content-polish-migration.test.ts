import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260905150000_polish_federations_and_add_lightweight_junior_nationals.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("federation content polish migration", () => {
  it("opens candidacies, votes and jersey publication to every federation", () => {
    expect(migration).toContain("settle_due_federation_elections");
    expect(migration).toContain("submit_national_federation_candidacy");
    expect(migration).toContain("vote_national_federation_president");
    expect(migration).toContain("publish_national_federation_jersey");
    expect(migration).toContain("if position('<> ''BE'''");
  });

  it("guards amateur affiliation changes and updates sponsor geography", () => {
    expect(migration).toContain("team_national_affiliation_change_once_per_season");
    expect(migration).toContain("contract.status in ('active', 'planned')");
    expect(migration).toContain("set home_country_id = v_new_country.id");
    expect(migration).toContain("set registration_country_id = v_new_country.id");
  });

  it("settles all junior nationals at J7 without the full race engine", () => {
    expect(migration).toContain(
      "settle_due_lightweight_junior_national_championships",
    );
    expect(migration).toContain("academy.hills * .46");
    expect(migration).toContain("development_hash_unit");
    expect(migration).toContain("start_day_number = 7");
    expect(migration).not.toContain("simulate_development_race(");
  });
});
