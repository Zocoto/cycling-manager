import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260827062000_sync_professional_naturalization_on_rollover.sql",
  ),
  "utf8",
).toLowerCase();

describe("professional naturalization rollover", () => {
  it("freezes the previous country at the season boundary", () => {
    expect(migration).toContain("public.get_rider_country_progress_days(");
    expect(migration).toContain("when v_previous_season_id is not null then 28");
    expect(migration).toContain("active_since_season_id = null");
  });

  it("starts the new team country at J1 for carried riders", () => {
    expect(migration).toContain("else 1");
    expect(migration).toContain(
      "running.country_id = context.target_country_id",
    );
    expect(migration).toContain(
      "on conflict (rider_id, country_id) do update",
    );
  });

  it("keeps the actual joining day for current-season recruits", () => {
    expect(migration).toContain(
      "when contract.start_season_id = v_season.id",
    );
    expect(migration).toContain(
      "then coalesce(contract.joined_day_number, 1)",
    );
  });

  it("runs during future season activations and repairs the current season", () => {
    expect(migration).toContain(
      "create or replace function public.settle_expiring_rider_contracts()",
    );
    expect(migration).toContain(
      "perform public.sync_active_professional_naturalization_progress(",
    );
    expect(migration).toContain("do $repair$");
  });

  it("preserves the latest expired-contract settlement safeguards", () => {
    expect(migration).toContain("where rider.status <> 'retired'");
    expect(migration).toContain(
      "expired_contract.status = 'completed'",
    );
  });
});
