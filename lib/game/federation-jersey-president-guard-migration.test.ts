import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260907193000_restrict_federation_jersey_to_president.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("federation jersey presidential guard migration", () => {
  it("accepts only the active or incoming elected president", () => {
    expect(migration).toContain("national_federation_terms as term");
    expect(migration).toContain("term.president_director_id = v_director_id");
    expect(migration).toContain("national_federation_elections as election");
    expect(migration).toContain("election.elected_director_id = v_director_id");
    expect(migration).toContain("election.election_type = 'exceptional'");
    expect(migration).toContain(
      "Seul le président élu peut modifier le maillot national.",
    );
  });

  it("qualifies the persisted version and removes the PL/pgSQL ambiguity", () => {
    expect(migration).toContain("jersey.version");
    expect(migration).toContain("jersey.pending_version");
    expect(migration).not.toContain("greatest(version, coalesce(pending_version");
  });

  it("keeps validation, locking and least-privilege grants", () => {
    expect(migration).toContain("octet_length(p_design::text) > 20000");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("on conflict (country_id) do update");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated, service_role");
  });
});
