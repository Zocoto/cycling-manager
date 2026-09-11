import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260911083000_repair_legacy_junior_world_championship_classification.sql",
  "utf8",
);
const originalFederationMigration = readFileSync(
  "supabase/migrations/20260904110000_federation_junior_championship_registrations.sql",
  "utf8",
);
const originalCalendar = originalFederationMigration
  .split("create or replace function public.ensure_federation_junior_championship_calendar(")[1]
  .split("$$;")[0];

describe("legacy junior world classification repair", () => {
  it("only repairs identified, unfinished world events from Season 3 onward", () => {
    expect(migration).toContain("season.game_year >= 3");
    expect(migration).toContain("season.status in ('active', 'planned')");
    expect(migration).toContain("edition.status = 'planned'");
    expect(migration).toContain("edition.is_world_championship = true");
    expect(migration).toContain("edition.competition_type = 'open'");
    expect(migration).toContain("edition.slug in ('mondial-junior-clm', 'mondial-junior-route')");
    expect(migration).toContain("where result.race_edition_id = edition.id");
    expect(migration).toContain("when 'mondial-junior-clm' then 'world_time_trial'");
    expect(migration).toContain("when 'mondial-junior-route' then 'world_road'");
  });

  it("preserves race IDs, dates, courses, finances, quotas and existing registrations", () => {
    const setClause = migration.split("update public.development_race_editions as edition")[1]
      .split("from public.seasons as season")[0];
    expect(setClause).toContain("selection_mode = 'automatic'");
    expect(setClause).toContain("points_scale = 'world'");
    expect(setClause).not.toMatch(/(?:\bid|day_number|profile_type|country_code|distance_km|reward_pool|selection_minimum|selection_maximum)\s*=/);
    expect(migration).not.toMatch(/(?:update|delete from|insert into) public\.(?:development_race_stages|development_race_results|development_race_registrations)\b/);
  });

  it("hooks repair before federation seeding and fails rather than silently missing an evolved function", () => {
    const anchor = "  if coalesce(v_game_year, 0) < 3 then return 0; end if;";
    expect(originalCalendar.split(anchor)).toHaveLength(2);
    expect(originalCalendar.indexOf(anchor)).toBeLessThan(originalCalendar.indexOf("with hosts"));
    expect(migration).toContain("pg_catalog.pg_get_functiondef");
    expect(migration).toContain("'public.ensure_federation_junior_championship_calendar(uuid)'::regprocedure");
    expect(migration).toContain("raise exception 'Unexpected federation junior calendar definition");
    expect(migration).toContain("execute replace(v_definition, v_anchor, v_anchor || E'\\n\\n' || v_call)");
  });

  it("runs the patched federation calendar after the base calendar has inserted future editions", () => {
    const ensureCalendar = originalFederationMigration
      .split("create or replace function public.ensure_development_race_calendar(")[1]
      .split("$$;")[0];
    expect(ensureCalendar.indexOf("public.ensure_development_race_calendar_pre_federation_juniors(")).toBeLessThan(
      ensureCalendar.indexOf("public.ensure_federation_junior_championship_calendar(p_season_id)"),
    );
  });
});
