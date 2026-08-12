import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260812143000_optimize_bulk_rider_contract_renewal.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const bulkRenewalStart = migration.indexOf(
  "create or replace function public.renew_all_current_team_riders",
);
const individualRenewalFunction = migration.slice(
  migration.indexOf(
    "create or replace function public.renew_current_team_rider",
  ),
  bulkRenewalStart,
);
const bulkRenewalFunction = migration.slice(
  bulkRenewalStart,
  migration.indexOf(
    "revoke all on function public.renew_current_team_rider",
    bulkRenewalStart,
  ),
);

describe("bulk rider contract renewal optimization migration", () => {
  it("stores an individual renewal as a distinct salaried S2 contract", () => {
    expect(individualRenewalFunction).toContain(
      "public.calculate_rider_season_salary(",
    );
    expect(individualRenewalFunction).toContain(
      "'planned'",
    );
    expect(individualRenewalFunction).toContain(
      "'renewal'",
    );
    expect(individualRenewalFunction).not.toContain(
      "update public.rider_contracts\n  set end_season_id",
    );
  });

  it("reuses the already provisioned next season", () => {
    expect(bulkRenewalFunction).toContain(
      "next_season.game_year = v_context.game_year + 1",
    );
    expect(bulkRenewalFunction).toContain("final_day.day_number = 28");
    expect(bulkRenewalFunction).toContain(
      "if v_next_season_id is null then",
    );
  });

  it("creates salaried S2 contracts together without invoking the heavy RPC per rider", () => {
    expect(bulkRenewalFunction).toContain("with eligible_contracts as (");
    expect(bulkRenewalFunction).toContain(
      "insert into public.rider_contracts (",
    );
    expect(bulkRenewalFunction).toContain(
      "public.calculate_rider_season_salary(",
    );
    expect(bulkRenewalFunction).toContain(
      "'planned'",
    );
    expect(bulkRenewalFunction).not.toContain(
      "public.renew_current_team_rider(",
    );
  });

  it("keeps serialization and excludes riders already committed elsewhere", () => {
    expect(bulkRenewalFunction).toContain(
      "pg_catalog.pg_advisory_xact_lock",
    );
    expect(bulkRenewalFunction).toContain(
      "successor.status in ('planned', 'active')",
    );
  });

  it("repairs zero-salary extensions without repricing the current season", () => {
    expect(migration).toContain(
      "contract.salary_per_season = 0",
    );
    expect(migration).toContain(
      "set end_season_id = v_current_season.id",
    );
    expect(migration).toContain(
      "Régulariser les contrats gratuits déjà étendus directement jusqu'en S2",
    );
  });
});
