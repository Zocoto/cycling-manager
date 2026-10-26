import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261026160000_s5_international_championship_quotas.sql", "utf8");

describe("S5 championship quota delivery safeguards", () => {
  it("keeps historic eligibility and gates changes behind S5", () => {
    expect(sql).toContain("case when v_season.game_year >= 5 then 60 else 30 end");
    expect(sql).toContain("v_season.game_year >= 5 or ranked.continental_rank <= 20");
    expect(sql).not.toMatch(/update\s+(?:public\.)?international_nation_qualification_snapshots/i);
    expect(sql).not.toMatch(/^update public\.(?:race_rosters|national_federation_selection_lists|national_federation_selection_members)\b/im);
    expect(sql).not.toMatch(/select\s+public\.(?:freeze_due|prepare_due|process_due)/i);
  });

  it("retains the existing page RPC until S5 and does not add a query", () => {
    const service = readFileSync("services/federation-selections.ts", "utf8");
    expect(service).toContain('gameYear >= 5 ? "get_national_federation_preselection_schedule_v2" : "get_national_federation_preselection_schedule"');
    expect(service.match(/admin\.rpc\(/g)).toHaveLength(1);
    expect(sql).toContain("from public.get_national_federation_preselection_schedule(p_country_id,p_season_id) schedule");
  });

  it("preserves Olympic quotas and uses existing consent locking", () => {
    expect(sql).toContain("q.time_trial_rider_quota else q.rider_quota");
    expect(sql).toContain("for update of selection_list");
    expect(sql).toContain("response_status='confirmed'");
    for (const path of ["20261012160000_global_olympic_quotas_and_callups.sql"]) {
      const previous = readFileSync(`supabase/migrations/${path}`, "utf8");
      for (const fn of ["save_national_federation_preselection", "publish_national_federation_preselection", "sync_national_federation_championship_lineup", "prepare_due_automatic_federation_professional_lineups", "refill_national_federation_professional_selection"]) {
        expect(previous).toContain(`public.${fn}(`);
      }
    }
  });

  it("bounds DDL locks and updates only future unstarted editions", () => {
    expect(sql).toContain("set local lock_timeout = '3s'");
    expect(sql).toContain("set local statement_timeout = '15s'");
    expect(sql).toContain("season.game_year>=5");
    expect(sql).toContain("edition.status not in ('completed','cancelled')");
    expect(sql.trim()).toMatch(/commit;$/);
  });
});
