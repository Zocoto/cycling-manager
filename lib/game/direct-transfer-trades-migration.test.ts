import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(),
  "supabase/migrations/20261022190000_add_direct_transfer_trade_offers.sql"), "utf8").replace(/\r\n/g, "\n");
const body = (name: string) => {
  const start = sql.search(new RegExp(`create(?: or replace)? function ${name.replaceAll(".", "\\.")}\\(`));
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf("\n$$;", start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
};

describe("direct rider trades: migration safety contract", () => {
  it("allows zero cash only when a distinct rider is included", () => {
    expect(sql).toContain("offered_rider_id is null and offered_amount between 500 and 100000000");
    expect(sql).toContain("offered_rider_id is not null and offered_amount between 0 and 100000000");
    expect(sql).toContain("offered_rider_id <> rider_id");
    expect(body("public.submit_direct_transfer_trade_offer")).toContain("'NaN', 'Infinity', '-Infinity'");
  });

  it("preserves reviewed cash cores instead of rewriting their business rules", () => {
    expect(sql).toContain("$verified_live_core$");
    expect(sql).toContain("a89fd68e61df7d153c31537ebd6b35fa");
    expect(sql).toContain("915a479051739453000889726bef123d");
    expect(sql).toContain("alter function public.submit_direct_transfer_offer_cash_20261022(uuid, numeric) set schema private");
    expect(sql).toContain("private.respond_to_direct_transfer_offer_cash_20261022(p_offer_id, p_accept)");
    expect(sql).not.toContain("create or replace function public.get_team_transfer_reserved_budget");
  });

  it("uses local ordered fail-fast locks, never a new global market lock", () => {
    const scope = body("private.lock_direct_transfer_scope");
    expect(scope).toContain("pg_try_advisory_xact_lock");
    expect(scope).toContain("'team-roster:'");
    expect(scope).toContain("order by contract.rider_id, contract.id");
    expect(scope).toContain("order by offer.id");
    expect(scope).toContain("for update nowait");
    expect(scope).not.toContain("'settle_transfer_market'");
    expect(body("public.submit_direct_transfer_trade_offer")).toContain("for share nowait");
    expect(body("public.respond_to_direct_transfer_offer")).toContain("for share nowait");
    expect(sql).toContain("set local lock_timeout = '2s'");
    expect(sql).toContain("set local statement_timeout = '8s'");
  });

  it("indexes pending offers on both sides and invalidates departed counterparts", () => {
    expect(sql).toContain("on public.direct_transfer_offers (offered_rider_id, buyer_team_id)");
    expect(sql).toContain("where status = 'pending' and offered_rider_id is not null");
    const cancel = body("public.cancel_pending_direct_transfer_offers");
    expect(cancel).toContain("offer.offered_rider_id = p_rider_id and offer.buyer_team_id = p_seller_team_id");
    expect(sql).toContain("after delete or update of status, team_id on public.rider_contracts");
  });

  it("keeps both transfers and the real cash adjustment in one transaction", () => {
    const response = body("public.respond_to_direct_transfer_offer");
    expect(response).toContain("private.assert_rider_trade_eligible(v_offer.rider_id");
    expect(response).toContain("private.assert_rider_trade_eligible(v_offer.offered_rider_id");
    expect(response.indexOf("set status = 'accepted'")).toBeLessThan(response.indexOf("set status = 'terminated'"));
    expect(response.match(/insert into public\.rider_contracts/g)).toHaveLength(2);
    expect(response).toContain("v_context.season_id, 0");
    expect(response).toContain("if v_offer.offered_amount > 0 then");
    expect(response).not.toMatch(/exception\s+when\s+others/iu);
    expect(sql.trim().startsWith("begin;")).toBe(true);
    expect(sql.trim().endsWith("commit;")).toBe(true);
  });

  it("preserves live commitments and checks ownership again at the actual write", () => {
    const eligible = body("private.assert_rider_trade_eligible");
    expect(eligible).toContain("registration.status in ('pending', 'accepted')");
    expect(eligible).toContain("edition.status not in ('completed', 'cancelled')");
    expect(eligible).toContain("camp.status in ('planned', 'active')");
    expect(eligible).toContain("reconnaissance.status in ('planned', 'active')");
    const guard = body("private.guard_live_rider_commitment_ownership");
    expect(guard).toContain("if v_team_id is null then return new; end if;");
    expect(guard).toContain("for key share nowait");
    expect(sql).not.toMatch(/delete from public\.(?:race_rosters|rider_form_camps|stage_reconnaissances)/u);
  });

  it("keeps internal cores private and preserves the restricted cash entry point", () => {
    expect(sql).toContain("revoke all on function private.submit_direct_transfer_offer_cash_20261022(uuid, numeric) from public, anon, authenticated, service_role");
    expect(sql).toContain("revoke all on function public.submit_direct_transfer_offer(uuid, numeric) from public, anon, authenticated, service_role");
    expect(sql).toContain("revoke all on function public.submit_direct_transfer_trade_offer(uuid, numeric, uuid, text) from public, anon");
    expect(sql).toContain("grant execute on function public.submit_direct_transfer_trade_offer(uuid, numeric, uuid, text) to authenticated, service_role");
    expect(body("public.cancel_current_direct_transfer_offer")).toContain("director.auth_user_id = auth.uid()");
  });
});
