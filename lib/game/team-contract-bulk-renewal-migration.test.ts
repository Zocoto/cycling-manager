import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260809130000_add_bulk_rider_contract_renewal.sql",
  ),
  "utf8",
);

describe("bulk rider contract renewal migration", () => {
  it("derives the team from the authenticated sporting director", () => {
    expect(migration).toContain("public.renew_all_current_team_riders()");
    expect(migration).toContain("director.auth_user_id = auth.uid()");
    expect(migration).toContain("assignment.role = 'general_manager'");
  });

  it("renews only expiring riders without a future contract", () => {
    expect(migration).toContain("contract.status = 'active'");
    expect(migration).toContain(
      "contract_end.game_year <= v_context.game_year",
    );
    expect(migration).toContain("and not exists (");
    expect(migration).toContain(
      "successor.status in ('planned', 'active')",
    );
    expect(migration).toContain(
      "public.renew_current_team_rider(v_rider.rider_id)",
    );
  });

  it("serializes the team operation and exposes it only to authenticated users", () => {
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("to authenticated, service_role");
  });
});
