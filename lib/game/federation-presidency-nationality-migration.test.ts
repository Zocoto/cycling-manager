import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260906130000_enforce_federation_president_nationality.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const governanceService = readFileSync(
  join(process.cwd(), "services/federation-governance.ts"),
  "utf8",
).replace(/\r\n/g, "\n");
const maintenanceRoute = readFileSync(
  join(process.cwd(), "app/api/cron/game-maintenance/route.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("federation presidency nationality", () => {
  it("projects the principal sponsor nationality across the whole mandate", () => {
    expect(migration).toContain(
      "get_projected_team_federation_country_id",
    );
    expect(migration).toContain("contract.status in ('active', 'planned')");
    expect(migration).toContain("contract.role = 'principal'");
    expect(migration).toContain("pg_catalog.generate_series(");
    expect(migration).toContain(
      "Votre prochain sponsor principal rattache votre équipe à une autre fédération",
    );
  });

  it("withdraws a candidacy that becomes invalid after a sponsor signature", () => {
    expect(migration).toContain(
      "withdraw_ineligible_federation_candidates",
    );
    expect(migration).toContain(
      "sponsor_contract_federation_eligibility_guard",
    );
    expect(migration).toContain("set withdrawn_at = now()");
    expect(migration).toContain("Candidature fédérale retirée");
  });

  it("vacates the presidency and runs an exceptional 48h plus 48h election", () => {
    expect(migration).toContain("election_type in ('regular', 'exceptional')");
    expect(migration).toContain("president_director_id = null");
    expect(migration).toContain(
      "team_season.registration_country_id <> term.country_id",
    );
    expect(migration).toContain("open_exceptional_federation_election");
    expect(migration).toContain("now() + interval '48 hours'");
    expect(migration).toContain("now() + interval '96 hours'");
    expect(migration).toContain(
      "settle_due_exceptional_federation_elections",
    );
    expect(migration).toContain("Présidence vacante");
    expect(migration).toContain("Nouveau président élu");
  });

  it("settles exceptional elections from maintenance and exposes them in governance", () => {
    expect(maintenanceRoute).toContain(
      '"settle_due_exceptional_federation_elections"',
    );
    expect(governanceService).toContain(
      'election.election_type === "exceptional"',
    );
    expect(governanceService).toContain("candidacyBlockReason");
  });
});
