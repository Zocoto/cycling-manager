import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261001060000_stabilize_annual_sponsor_page.sql",
  ),
  "utf8",
).replaceAll("\r", "");

describe("annual sponsor page stability migration", () => {
  it("scopes performance and commitment satisfaction to the objective season", () => {
    expect(migration).toContain(
      "event.season_id = coalesce(\n     contract.objective_season_id,\n     contract.start_season_id",
    );
    expect(migration).toContain(
      "event.event_type in ('race_result', 'uci_ranking')",
    );
    expect(migration).toContain(
      "event.event_type = 'pre_race_commitment'",
    );
  });

  it("computes the annual base from canonical database satisfaction", () => {
    expect(migration).toContain(
      "public.get_sponsor_objective_satisfaction_score(v_contract.id)",
    );
    expect(migration).toContain(
      "public.get_sponsor_performance_satisfaction_score(v_contract.id)",
    );
    expect(migration).toContain("v_live_satisfaction := least(");
    expect(migration).toContain("v_authoritative_base := round(");
    expect(migration).not.toContain(
      "raise exception 'La satisfaction sponsor a évolué. Rechargez la page.'",
    );
  });

  it("repairs an existing preview without losing the chosen ambition", () => {
    expect(migration).toContain("case v_offer.objective_difficulty");
    expect(migration).toContain(
      "set base_budget_per_season = v_authoritative_base",
    );
    expect(migration).toContain("if v_budget_changed then");
    expect(migration).toContain("status = 'draft'");
    expect(migration).toContain(
      "set pending_sponsor_offer_id = v_offer_id,",
    );
  });

  it("refreshes every active principal contract as a curative pass", () => {
    expect(migration).toContain(
      "update public.team_sponsor_contracts\nset satisfaction_score = satisfaction_score",
    );
    expect(migration).toContain("and status = 'active'");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });
});
