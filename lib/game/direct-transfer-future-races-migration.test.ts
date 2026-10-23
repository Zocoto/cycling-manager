import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";
const sql=readFileSync(resolve(process.cwd(),"supabase/migrations/20261023160000_allow_future_races_in_rider_trades.sql"),"utf8");
describe("future race withdrawal in direct rider trades",()=>{
  it("checks live races, started tours, official locks and the precompute horizon",()=>{
    expect(sql).toContain("v_edition.status='in_progress'");
    expect(sql).toContain("stage.status in ('in_progress','completed')");
    expect(sql).toContain("clock_timestamp()+interval '7 minutes'");
    expect(sql).toContain("public.official_stage_simulations");
    expect(sql).toContain("public.official_stage_simulation_claims");
    expect(sql).toContain("order by edition.id for update nowait");
  });
  it("withdraws only the proposing rider at creation and both riders at acceptance",()=>{
    expect(sql).toContain("private.withdraw_trade_future_races(p_offered_rider_id,v_offer_id)");
    expect(sql).not.toContain("private.withdraw_trade_future_races(p_rider_id,v_offer_id)");
    expect(sql).toContain("private.withdraw_trade_future_races(v_offer.rider_id,v_offer.id)");
    expect(sql).toContain("private.withdraw_trade_future_races(v_offer.offered_rider_id,v_offer.id)");
    expect(sql).toContain("edition.status in ('planned','registration_open','registration_closed')");
    expect(sql).not.toMatch(/delete from public\.(race_rosters|rider_form_camps|stages|official_stage_simulations)/);
  });
  it("keeps the helpers private, updates national replies and alerts underfilled squads",()=>{
    expect(sql).toContain("set response_status='declined'");
    expect(sql).toContain("if v_count<v_minimum then");
    expect(sql).toContain("'#inscription'");
    expect(sql).toContain("on conflict (sporting_director_id,source_reference) do nothing");
    expect(sql).toContain("private.assert_trade_races_not_started(uuid) from public,anon,authenticated,service_role");
    expect(sql).toContain("private.withdraw_trade_future_races(uuid,uuid) from public,anon,authenticated,service_role");
    expect(sql).toContain("set local lock_timeout = '1s'");
    expect(sql).toContain("set local statement_timeout = '5s'");
  });
});
