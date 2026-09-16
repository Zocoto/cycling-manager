import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const futureCredit = readFileSync(
  join(process.cwd(), "supabase/migrations/20260916100000_credit_daily_nutrition_to_next_day_state.sql"),
  "utf8",
);
const historicalRepair = readFileSync(
  join(process.cwd(), "supabase/migrations/20260916101000_reconcile_verified_daily_nutrition_gaps.sql"),
  "utf8",
);

describe("règlement de la nutrition quotidienne", () => {
  it("crée l'état du lendemain avant l'entraînement et marque le crédit", () => {
    expect(futureCredit).toContain("insert into public.rider_condition_states (");
    expect(futureCredit).toContain("v_day.next_day_id");
    expect(futureCredit).toContain("on conflict (rider_id, season_day_id) do update set");
    expect(futureCredit).toContain("condition_applied_at = now()");
    expect(futureCredit).toContain("if v_inserted_id is not null then");
  });

  it("ne rattrape que les effets historiques prouvés absents", () => {
    expect(historicalRepair).toContain("effect.condition_applied_at is null");
    expect(historicalRepair).toContain("state.updated_at = state.created_at");
    expect(historicalRepair).toContain("state.source <> 'nutritionist'");
    expect(historicalRepair).toContain("state.updated_at = last_stage.applied_at");
    expect(historicalRepair).toContain("state.updated_at = intervention.applied_at");
    expect(historicalRepair).toContain("delete from verified_nutrition_gaps where evidence is null");
    expect(historicalRepair).toContain("v_after := least(100, v_state.form + v_rider.requested_gain)");
    expect(historicalRepair).toContain("rider_daily_nutrition_repair_audit");
  });
});
