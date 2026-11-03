import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261103100000_daily_form_camp_reports.sql"),
  "utf8",
).replace(/\r\n/g, "\n");
const helper = sql.split("create or replace function private.get_team_daily_form_camp_report(")[1]
  .split("revoke all on function private.get_team_daily_form_camp_report")[0];
const rpc = sql.split("create or replace function public.get_current_team_daily_form_camp_report(")[1]
  .split("-- Add a compact report")[0];

describe("daily form-camp report SQL contract", () => {
  it("starts from the indexed team's camp cohort and verifies season/day membership", () => {
    expect(sql).toContain("rider_form_camps_daily_report_team_idx");
    expect(helper).toContain("eligible_camps as materialized");
    expect(helper).toContain("camp.team_season_id = p_team_season_id");
    expect(helper).toContain("team_season.season_id = camp.season_id");
    expect(helper).toContain("day.season_id = camp.season_id");
    expect(helper).toContain("day.day_number between camp.start_day_number and camp.end_day_number");
    expect(helper).toContain("camp.camp_type in ('classic', 'premium')");
    expect(helper).toContain("effect.rider_id = camp.rider_id");
    expect(helper).toContain("effect.season_day_id = p_season_day_id");
  });

  it("reports earned, capped gains and retains interrupted historical days without duplicates", () => {
    expect(helper).toContain("effect.effect_type = 'form_camp'");
    expect(helper).toContain("greatest(0, effect.form_after - effect.form_before) as actual_form_gain");
    expect(helper).toContain("select distinct on (effect.id)");
    expect(helper).toContain("'formDelta', report.actual_form_gain");
    expect(helper).toContain("coalesce(sum(report.actual_form_gain), 0)");
    expect(helper).not.toContain("effect.form_delta");
    expect(helper).toContain("camp.created_at <= effect.applied_at");
    expect(helper).toContain("camp.status <> 'cancelled'");
    expect(helper).toContain("camp.interruption_requested_at is not null");
    expect(helper).toContain("camp.day_number < camp.interruption_effective_day_number");
    expect(helper).toContain("camp.completed_at > effect.applied_at");
  });

  it("authenticates the current director instead of accepting another team's ID", () => {
    expect(rpc).toContain("director.auth_user_id = auth.uid()");
    expect(rpc).toContain("assignment.role = 'general_manager'");
    expect(rpc).toContain("assignment.status = 'active'");
    expect(rpc).toContain("team_season.status = 'active'");
    expect(rpc).toContain("season.status = 'active'");
    expect(rpc).toContain("security definer\nset search_path = ''");
    expect(rpc).toContain("if v_context is null then return null; end if;");
    expect(rpc).not.toContain("p_team");
    expect(sql).toContain("from public, anon, authenticated;");
    expect(rpc).toContain("from public, anon, service_role;");
    expect(rpc).toContain("to authenticated;");
  });

  it("allows only completed days and never reads J1's unfinished camp ledger", () => {
    expect(rpc).toContain("coalesce(p_day_number, v_context.current_day_number - 1)");
    expect(rpc).toContain("greatest(1, v_context.current_day_number - 1)");
    expect(rpc).toContain("if v_context.current_day_number > 1 then");
    expect(rpc).toContain("'riders', '[]'::jsonb, 'riderCount', 0, 'totalFormGain', 0");
    expect(sql).toContain("previous_day.day_number = context.current_day_number - 1");
    expect(sql).toContain("offset 0\n        ) as report");
    expect(sql).toContain("where (report.data ->> 'riderCount')::integer > 0");
  });

  it("extends the existing bounded assistant payload without settling or modifying gameplay", () => {
    expect(sql).toContain("set statement_timeout = '3000ms'");
    expect(sql).toContain("set local lock_timeout = '3s'");
    expect(sql).toContain("set local statement_timeout = '15s'");
    expect(sql).toContain("position('formCampReport' in v_definition) > 0");
    expect(sql).toContain("/ length(v_anchor) <> 1");
    expect(sql).toContain("pg_get_functiondef(");
    expect(sql).not.toMatch(/\b(?:settle_|process_current|sync_active_season_day|insert into|update public\.|delete from)/i);
    expect(sql).not.toContain("alter function public.get_current_dashboard_assistant_summary");
  });
});
