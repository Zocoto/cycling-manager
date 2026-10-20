import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(),
  "supabase/migrations/20261020121000_bound_performance_preparation_context.sql"), "utf8");
const normalized = migration.replace(/\s+/g, " ");
const service = readFileSync(resolve(process.cwd(), "services/race-calendar.ts"), "utf8");

describe("bounded performance preparation context migration", () => {
  it("clones the installed metadata core rather than rebuilding a stale return shape", () => {
    expect(migration).toContain("pg_catalog.pg_get_functiondef(v_legacy_oid)");
    expect(migration).toContain("pg_catalog.pg_get_function_result(v_legacy_oid)");
    expect(migration).toContain("execute v_core_definition");
    expect(migration).toContain("returns %s");
    expect(migration).not.toMatch(/returns table\s*\(/i);
    expect(migration).not.toMatch(/drop\s+(function|table)\b/i);
    expect(migration).not.toMatch(/\b(insert into|update|delete from)\s+public\./i);
  });

  it("retains the legacy OID and provides two unambiguous arities with no defaults", () => {
    expect(migration).toContain("public.get_race_calendar_rider_context(uuid[],integer,integer)");
    expect(migration).toContain("public.get_race_calendar_rider_context(p_rider_ids uuid[], p_min_game_day integer, p_max_game_day integer)");
    expect(migration).toContain("create or replace function public.get_race_calendar_rider_context(p_rider_ids uuid[])");
    expect(migration).toContain("select * from public.get_race_calendar_rider_context(");
    expect(migration).toContain("p_rider_ids, null::integer, null::integer);");
    expect(migration).toContain("procedure.pronargdefaults = 0");
    expect(migration).toContain("procedure.pronargdefaults <> 0");
    expect(migration).not.toMatch(/p_(?:min|max)_game_day integer\s+default/i);
  });

  it("guards exactly one source patch and rejects conflicting partial installations", () => {
    expect(migration).toContain("from pg_catalog.regexp_matches(v_legacy_definition, v_predicate_pattern, 'g')");
    expect(migration.match(/if v_patch_count <> 1 then/g)).toHaveLength(2);
    expect(migration).toContain("Unexpected partial rider context migration");
    expect(migration).toContain("Unexpected installed rider context core or compatibility wrapper");
    expect(migration).toContain("performance-preparation-context-window-v1");
    expect(migration).toContain("performance-preparation-context-legacy-v1");
    expect(migration).toContain("pg_catalog.pg_get_function_result(v_core_oid) <> v_return_type");
  });

  it("filters inclusive date overlaps before aggregation and preserves NULL legacy bounds", () => {
    expect(migration).toContain("preparation.bonus_end_game_day >= coalesce(p_min_game_day, -2147483648)");
    expect(migration).toContain("preparation.bonus_start_game_day <= coalesce(p_max_game_day, 2147483647)");
    expect(migration).toContain("attribute.atttypid = 'integer'::regtype");
    expect(migration).toContain("attribute.attnotnull and not attribute.attisdropped");
    expect(migration).not.toMatch(/current_date|now\(\)|limit\s+\d|status\s*=\s*'completed'/i);
    expect(service).toContain("gameYear: season.game_year");
    expect(service).toContain("const minGameDay = gameYear * 28");
    expect(service).toContain("const maxGameDay = minGameDay + 27");
    expect(service).toContain("p_min_game_day: minGameDay");
    expect(service).toContain("p_max_game_day: maxGameDay");
    expect(service).toContain('.lte("bonus_start_game_day", maxGameDay)');
    expect(service).toContain('.gte("bonus_end_game_day", minGameDay)');
  });

  it("adds a selective end-date index without removing the existing access paths", () => {
    expect(normalized).toContain("create index if not exists rider_performance_preparations_rider_window_idx on public.rider_performance_preparations( rider_id, bonus_end_game_day, bonus_start_game_day ) where status <> 'cancelled'");
    expect(migration).not.toMatch(/drop\s+index/i);
  });

  it("bounds migration lock waits and keeps both RPCs private to the backend", () => {
    expect(migration.trim()).toMatch(/^begin;/);
    expect(migration.trim()).toMatch(/commit;$/);
    expect(migration).toContain("set local lock_timeout = '3s'");
    expect(migration).toContain("set local statement_timeout = '8s'");
    expect(migration).toContain("set local application_name = 'cyclostratege-preparation-context-window-20261020'");
    expect(migration).toContain("notify pgrst, 'reload schema'");
    expect(migration).toContain("language sql stable security definer set search_path = ''''");
    for (const signature of ["uuid[]", "uuid[], integer, integer"]) {
      expect(normalized).toContain(`revoke all on function public.get_race_calendar_rider_context(${signature}) from public, anon, authenticated`);
      expect(normalized).toContain(`grant execute on function public.get_race_calendar_rider_context(${signature}) to service_role`);
    }
    expect(migration.match(/\$migration\$/g)).toHaveLength(2);
  });
});
