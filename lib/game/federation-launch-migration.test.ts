import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260909180000_launch_all_federations.sql",
  ),
  "utf8",
);
const maintenanceRoute = readFileSync(
  join(process.cwd(), "app/api/cron/game-maintenance/route.ts"),
  "utf8",
);
const dashboard = readFileSync(
  join(process.cwd(), "app/jeu/page.tsx"),
  "utf8",
);

describe("lancement de toutes les fédérations", () => {
  it("exposes a country-aware tile without the Belgian beta wording", () => {
    expect(dashboard).toContain("teamAmateurIdentity?.homeCountryCode");
    expect(dashboard).toContain(
      "href={`/jeu/federations/${federationCountryCode.toLowerCase()}`}",
    );
    expect(dashboard).not.toContain("bêta belge");
  });

  it("creates every player federation treasury instead of Belgium only", () => {
    expect(migration).toContain(
      "create or replace function public.initialize_due_national_federation_accounts()",
    );
    expect(migration).toContain("count(distinct assignment.sporting_director_id)");
    expect(migration).not.toContain("from public.countries where iso_alpha2 = 'BE'");
  });

  it("settles ordinary elections before the S3 J1 fallback", () => {
    const regularElection = maintenanceRoute.indexOf(
      '"settle_due_federation_elections"',
    );
    const initialFallback = maintenanceRoute.indexOf(
      '"initialize_due_federation_presidencies"',
    );
    const exceptionalElection = maintenanceRoute.indexOf(
      '"settle_due_exceptional_federation_elections"',
    );

    expect(regularElection).toBeGreaterThan(-1);
    expect(initialFallback).toBeGreaterThan(regularElection);
    expect(exceptionalElection).toBeGreaterThan(initialFallback);
    expect(migration).toContain("v_federation.player_count = 1");
    expect(migration).toContain("v_federation.player_count > 1");
  });

  it("caps repeatable solidarity grants at ten percent per season", () => {
    expect(migration).toContain(
      "drop constraint if exists national_federation_solidarity_plans_account_id_key",
    );
    expect(migration).toContain("v_limit := round(v_account.opening_balance * 0.10, 2)");
    expect(migration).toContain("v_total > v_remaining");
    expect(migration).toContain("distributedAmount");
  });
});
