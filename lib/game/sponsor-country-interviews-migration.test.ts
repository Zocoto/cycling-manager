import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260807120000_sync_sponsor_country_and_close_interviews.sql",
  ),
  "utf8",
);

describe("migration sponsor et interviews", () => {
  it("synchronise le pays de l'équipe avec le sponsor principal", () => {
    expect(migration).toContain("registration_country_id = sponsor.country_id");
    expect(migration).toContain("sync_team_sponsor_country");
  });

  it("clôture les interviews à 20 h de Paris", () => {
    expect(migration).toContain("close_expired_post_race_interviews");
    expect(migration).toContain("status = 'closed'");
    expect(migration).toContain("time '20:00'");
  });
});
