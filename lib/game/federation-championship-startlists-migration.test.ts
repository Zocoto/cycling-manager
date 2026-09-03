import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260903235900_sync_federation_championship_startlists.sql",
  ),
  "utf8",
);

describe("federation championship startlists migration", () => {
  it("links each published federation list to an official race registration", () => {
    expect(migration).toContain(
      "create table public.national_federation_selection_race_links",
    );
    expect(migration).toContain(
      "sync_national_federation_championship_lineup",
    );
    expect(migration).toContain("historical_team_name");
    expect(migration).toContain("response_status = 'confirmed'");
  });

  it("maps road and time-trial lists to the correct international edition", () => {
    expect(migration).toContain(
      "'world_championship', 'continental_championship'",
    );
    expect(migration).toContain("race.championship_continent_code");
    expect(migration).toContain("then 'individual_time_trial'");
    expect(migration).toContain("else 'road'");
  });

  it("keeps club registration unavailable and performs synchronization off the read path", () => {
    expect(migration).toContain("entry_method, status");
    expect(migration).toContain("'automatic', 'accepted'");
    expect(migration).toContain(
      "sync_due_national_federation_championship_lineups",
    );
    expect(migration).toContain("link.synced_at < selection_list.updated_at");
    expect(migration).toContain("set statement_timeout = '30s'");
  });

  it("lets one rider contest both disciplines of the same championship", () => {
    expect(migration).toContain(
      "other_race.competition_type = v_target_competition_type",
    );
    expect(migration).toContain(
      "other_race.championship_continent_code = v_target_continent_code",
    );
  });
});
