import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260904170000_create_federation_course_portfolio_and_hosting.sql",
  ),
  "utf8",
);
const service = readFileSync(
  join(process.cwd(), "services/federation-courses.ts"),
  "utf8",
);
const calendarService = readFileSync(
  join(process.cwd(), "services/race-calendar.ts"),
  "utf8",
);

describe("federation course portfolio and hosting migration", () => {
  it("persists a historical renown made of ten UCI seasons and national legacies", () => {
    expect(migration).toContain("create table public.national_federation_renown");
    expect(migration).toContain("limit 10");
    expect(migration).toContain("team_legacy_points");
    expect(migration).toContain("rider.country_id = p_country_id");
    expect(migration).toContain("hosting_legacy_points");
    expect(migration).toContain("score between 0 and 1000");
  });

  it("selects hosts at J21 with recency before UCI rank and renown", () => {
    for (const eventType of [
      "world_championship_pro",
      "continental_championship_pro",
      "nations_cup_pro",
      "world_championship_junior",
      "continental_championship_junior",
      "nations_cup_junior",
    ]) {
      expect(migration).toContain(`'${eventType}'`);
    }
    expect(migration).toContain("v_season.current_day_number < 21");
    expect(migration).toContain("v_recency_points");
    expect(migration).toContain("* 75");
    expect(migration).toContain("* 250");
    expect(migration).toContain("* 150");
    expect(migration).toContain("order by candidacy.selection_score desc");
    expect(migration).toContain("balance = balance - v_winner.hosting_cost");
    expect(migration).toContain(
      "ensure_development_race_calendar(v_target_season_id)",
    );
    expect(service).toContain("FEDERATION_HOSTING_EVENTS.map");
  });

  it("settles attendance revenue and exposes the host on that edition only", () => {
    expect(migration).toContain("actual_participation_rate");
    expect(migration).toContain("balance = balance + v_gross");
    expect(migration).toContain("add column if not exists host_country_id");
    expect(calendarService).toContain(
      "edition.host_country_id ?? race.country_id",
    );
  });

  it("provides detailed participation and money-or-prestige returns", () => {
    expect(service).toContain("teamParticipationPercentage");
    expect(service).toContain("riderFillPercentage");
    expect(service).toContain("calculateFederationRaceReturn");
    expect(service).toContain("projectedGrossRevenue");
  });
});
