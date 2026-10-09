import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readSource(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
}

const migration = readSource(
  "supabase/migrations/20260829143000_add_free_agent_detection_teams.sql",
);
const extension = readSource(
  "supabase/migrations/20261009140000_extend_detection_teams_to_local_and_regional.sql",
);
const localGeography = readSource(
  "supabase/migrations/20261009143000_prioritize_local_detection_geography.sql",
);
const maintenanceService = readSource("services/game-state-settlement.ts");
const resultService = readSource("services/race-results.ts");
const newsService = readSource("services/public-game-news.ts");

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
    expect(migration).toContain("team_country_iso_alpha2 text");
    expect(migration).toContain(
      "coalesce(team_country.iso_alpha2, race_country.iso_alpha2)",
    );
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

  it("extends the existing settlement to local and regional races", () => {
    expect(extension).toContain(
      "category.code in ('local', 'regional', 'national', 'continental', 'world')",
    );
    expect(extension).toContain(
      "when v_edition.category_code in ('regional', 'continental') then",
    );
    expect(extension).toContain("''local'', ''national''");
    expect(extension).toContain("pg_catalog.pg_get_functiondef(v_signature)");
    expect(extension).toContain("execute v_definition;");
  });

  it("changes only reviewed anchors and safely recognizes repeat installation", () => {
    expect(extension).toContain("<> 1 then");
    expect(extension).toContain("no changes applied.");
    expect(extension).toContain("only partially installed.");
    expect(extension).toContain("set local lock_timeout = '3s'");
    expect(extension).toContain("set local statement_timeout = '15s'");
    expect(extension).not.toMatch(/\b(update|delete\s+from|insert\s+into)\s+public\./i);
    expect(extension).not.toContain("perform public.settle_due_free_agent_detection_teams");
    expect(extension).not.toContain("select * from public.settle_due_free_agent_detection_teams");
  });

  it("ranks local country and neighbours before sporting level without changing other categories", () => {
    expect(localGeography).toContain("when v_edition.category_code = 'local' then");
    expect(localGeography).toContain("when rider.country_id = v_edition.race_country_id then 0");
    expect(localGeography).toContain("from public.country_adjacencies as adjacency");
    expect(localGeography).toContain("adjacency.country_id = v_edition.race_country_id");
    expect(localGeography).toContain("adjacency.adjacent_country_id = rider.country_id");
    expect(localGeography).toContain(
      "then 1\n              when rider_country.continent_code =\n                v_edition.race_continent_code then 2\n              else 3",
    );
    expect(localGeography).toContain("else 0\n        end asc,");
    expect(localGeography).toContain("only partially installed.");
    expect(localGeography).toContain("no changes applied.");
    expect(localGeography).toContain("set local lock_timeout = '3s'");
    expect(localGeography).toContain("set local statement_timeout = '15s'");
    expect(localGeography).not.toMatch(/\b(update|delete\s+from|insert\s+into)\s+public\./i);
    expect(localGeography).not.toMatch(/(?:select \* from|perform) public\.settle_due_free_agent_detection_teams/);
  });
});
