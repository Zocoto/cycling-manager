import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260921140000_allow_president_federation_solidarity.sql",
  ),
  "utf8",
);

describe("federation president solidarity migration", () => {
  it("makes the president team eligible without weakening financial caps", () => {
    expect(migration).not.toContain(
      "team_season.team_id <> v_identity.team_id",
    );
    expect(migration).toContain("'presidentTeamEligible', true");
    expect(migration).toContain("director.reputation_points <= p_reputation_threshold");
    expect(migration).toContain(
      "100000::numeric - coalesce(received.amount, 0)",
    );
    expect(migration).toContain("v_account.opening_balance * 0.10");
    expect(migration).toContain("if v_total > v_account.balance then");
  });

  it("keeps authorization limited to the current federation president", () => {
    expect(migration).toContain(
      "term.president_director_id = v_identity.sporting_director_id",
    );
    expect(migration).toContain(
      "Seul le président élu peut valider ce fonds.",
    );
  });
});
