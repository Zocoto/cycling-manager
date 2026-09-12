import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260912133000_protect_federation_elections_during_rollover.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const federationLaunchMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260909180000_launch_all_federations.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("federation election rollover guard", () => {
  it("does not withdraw candidates while no season is active", () => {
    const noActiveSeasonGuard = migration.indexOf(
      "if v_season.id is null then\n    return 0;\n  end if;",
    );
    const candidateLoop = migration.indexOf("for v_candidate in");

    expect(noActiveSeasonGuard).toBeGreaterThan(-1);
    expect(candidateLoop).toBeGreaterThan(noActiveSeasonGuard);
  });

  it("keeps automatic initialization limited to genuinely vacant terms", () => {
    expect(federationLaunchMigration).toContain(
      "and term.president_director_id is not null",
    );
    expect(federationLaunchMigration).toContain("continue;");
  });

  it("repairs only Alioch4's voted Japanese S3-S4 candidacy", () => {
    expect(migration).toContain("upper(country.iso_alpha2) = 'JP'");
    expect(migration).toContain("lower(director.username) = 'alioch4'");
    expect(migration).toContain("team_season.registration_country_id = v_country_id");
    expect(migration).toContain("where candidate.withdrawn_at is not null");
    expect(migration).toContain("having count(vote.id) > 0");
    expect(migration).toContain("set withdrawn_at = null");
  });

  it("restores the elected term and closes only the empty exceptional election", () => {
    expect(migration).toContain(
      "The Japanese exceptional election already has candidate or vote activity; repair aborted.",
    );
    expect(migration).toContain("from public.national_federation_votes as vote");
    expect(migration).toContain("status = 'finalized'");
    expect(migration).toContain("governance_mode = 'elected'");
    expect(migration).toContain(
      "president_director_id = v_candidate.sporting_director_id",
    );
    expect(migration).toContain("election_type = 'exceptional'");
    expect(migration).toContain("Mandat présidentiel rétabli");
  });

  it("preserves the audit trail instead of deleting election records", () => {
    expect(migration).not.toMatch(/delete\s+from\s+public\.national_federation_/i);
  });
});
