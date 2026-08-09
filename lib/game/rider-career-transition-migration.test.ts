import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260809120000_secure_rider_career_transitions.sql",
  ),
  "utf8",
);
const riderProfile = readFileSync(
  resolve(process.cwd(), "services/public-rider-profile.ts"),
  "utf8",
);

describe("rider career transitions", () => {
  it("returns equipment and cancels future commitments on departure", () => {
    expect(migration).toContain("public.detach_departing_rider");
    expect(migration).toContain(
      "delete from public.rider_equipment_assignments",
    );
    expect(migration).toContain("set status = 'withdrawn'");
    expect(migration).toContain("update public.rider_form_camps as camp");
    expect(migration).toContain("update public.stage_reconnaissances");
    expect(migration).toContain(
      "edition.status not in ('in_progress', 'completed', 'cancelled')",
    );
  });

  it("records each stint boundary and the incoming transfer price", () => {
    expect(migration).toContain("add column if not exists left_season_id");
    expect(migration).toContain("add column if not exists left_day_number");
    expect(migration).toContain("add column if not exists transfer_fee");
    expect(migration).toContain("public.record_transfer_fee_on_contract");
    expect(riderProfile).toContain("transferFee:");
    expect(riderProfile).toContain(
      "historyTeamKey(season.id, contract.team_id)",
    );
  });

  it("preserves one paused naturalization counter per country", () => {
    expect(migration).toContain(
      "create table public.rider_naturalization_country_progress",
    );
    expect(migration).toContain(
      "create unique index rider_naturalization_one_running_country_idx",
    );
    expect(migration).toContain("public.pause_rider_naturalization_progress");
    expect(migration).toContain("public.resume_rider_naturalization_progress");
    expect(migration).not.toContain("pg_cron");
  });

  it("switches country on a transfer or principal sponsor change", () => {
    expect(migration).toContain("public.handle_rider_contract_transition");
    expect(migration).toContain(
      "public.align_team_country_with_principal_sponsor",
    );
    expect(migration).toContain("after update of registration_country_id");
  });

  it("keeps the existing homegrown reconciliation trigger in the chain", () => {
    const homegrownMigration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260727101000_add_homegrown_special_ability.sql",
      ),
      "utf8",
    );
    expect(homegrownMigration).toContain(
      "public.reconcile_homegrown_ability_after_contract",
    );
    expect(homegrownMigration).toContain("ability_code = 'homegrown'");
  });
});
