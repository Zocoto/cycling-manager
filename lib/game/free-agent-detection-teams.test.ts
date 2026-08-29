import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260829143000_add_free_agent_detection_teams.sql",
  ),
  "utf8",
);
const maintenanceService = readFileSync(
  join(process.cwd(), "services/game-state-settlement.ts"),
  "utf8",
);
const resultService = readFileSync(
  join(process.cwd(), "services/race-results.ts"),
  "utf8",
);
const newsService = readFileSync(
  join(process.cwd(), "services/public-game-news.ts"),
  "utf8",
);

describe("free-agent detection teams", () => {
  it("fills only eligible standard races up to five teams", () => {
    expect(migration).toContain("race.competition_type = 'standard'");
    expect(migration).toContain(
      "category.code in ('national', 'continental', 'world')",
    );
    expect(migration).toContain("if v_real_team_count = 0 then");
    expect(migration).toContain(
      "5 - v_real_team_count - v_existing_detection_count",
    );
    expect(migration).toContain("v_edition.maximum_roster_size");
    expect(migration).toContain("v_edition.minimum_roster_size");
    expect(migration).toContain("Distribution en serpentin");
  });

  it("selects available riders by geography and race profile", () => {
    expect(migration).toContain("rider.status = 'free_agent'");
    expect(migration).toContain("rider.country_id = v_edition.race_country_id");
    expect(migration).toContain(
      "rider_country.continent_code =\n                  v_edition.race_continent_code",
    );
    for (const profile of [
      "mountain",
      "hilly",
      "sprint",
      "flat",
      "cobbles",
      "time_trial",
    ]) {
      expect(migration).toContain(`when '${profile}' then`);
    }
    expect(migration).toContain("from public.rider_contracts as contract");
    expect(migration).toContain("from public.rider_injuries as injury");
    expect(migration).toContain("from public.rider_form_camps as camp");
    expect(migration).toContain("for update of rider skip locked");
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
  });

  it("is idempotent and stays out of interactive reads", () => {
    expect(migration).toContain("detection_teams_finalized_at");
    expect(migration).toContain(
      "create unique index race_registrations_detection_team_unique_idx",
    );
    expect(migration).toContain(
      "on public.race_registrations (race_edition_id, detection_team_number)",
    );
    expect(maintenanceService).toContain('task === "elite-wildcards"');
    expect(maintenanceService).toContain(
      '"settle_due_free_agent_detection_teams"',
    );
  });

  it("keeps rewards individual and renders historical teams", () => {
    expect(migration).toContain(
      "apply_detection_rider_competition_reward",
    );
    expect(migration).toContain("sporting_director_id,\n    team_season_id");
    expect(migration).toContain("0,\n    0,\n    0,\n    greatest(0, p_uci_points)");
    expect(resultService).toContain(
      '"apply_detection_rider_competition_reward"',
    );
    expect(resultService).toContain(
      '"refresh_race_edition_uci_rankings"',
    );
    expect(resultService).toContain("historical_team_name:");
    expect(newsService).toContain("DETECTION_TEAM_JERSEY");
    expect(newsService).toContain("registration?.historical_team_name");
  });
});
