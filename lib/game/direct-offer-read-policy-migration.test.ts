import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const sql=readFileSync("supabase/migrations/20261023093000_fix_direct_offer_participant_read_policy.sql","utf8");
describe("direct-offer read policy regression",()=>{
  it("keeps participant-only visibility through the existing authenticated ownership helper",()=>{
    expect(sql).toContain("alter policy direct_transfer_offers_select_managed_teams");
    expect(sql).toContain("public.current_user_manages_team(buyer_team_id)");
    expect(sql).toContain("or public.current_user_manages_team(seller_team_id)");
    expect(sql).toContain("987f2a6be56aec95ae719181c23b189f");
    expect(sql).toContain("4537699f0a1249d5d275dd8f94535f42");
  });
  it("never broadens table grants, bypasses RLS or rewrites a transfer",()=>{
    const statements=sql.replace(/--[^\n]*/gu,"");
    expect(statements).not.toMatch(/\b(?:grant|revoke|insert|update|delete|truncate)\b/iu);
    expect(statements).not.toMatch(/create(?: or replace)? function|disable row level security/iu);
    expect(statements).not.toContain("using (true)");
    expect(statements).not.toContain("respond_to_direct_transfer_offer");
  });
  it("is a bounded additive migration",()=>{
    expect(sql.trim()).toMatch(/^begin;/u);expect(sql.trim()).toMatch(/commit;$/u);
    expect(sql).toContain("set local lock_timeout = '1s'");expect(sql).toContain("set local statement_timeout = '5s'");
  });
});
