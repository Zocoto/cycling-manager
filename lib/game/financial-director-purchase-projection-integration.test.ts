import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read(
  "supabase/migrations/20261021121000_align_df_purchase_projection.sql",
);

describe("financial director forecast consumers", () => {
  it("uses the same unbooked receipts for the purchase warning and auto restock", () => {
    expect(migration).toContain(
      "'public.get_current_team_purchase_financial_risk(numeric)'::regprocedure",
    );
    expect(migration).toContain(
      "'private.restock_fan_club_shop(uuid,integer)'::regprocedure",
    );
    expect(migration).toContain(
      "select round(v_projected_balance + coalesce(sum(projection.amount), 0), 2)",
    );
    expect(migration).toContain(
      "select v_projection + coalesce(sum(projection.amount), 0)",
    );
    expect(migration).toContain(
      "private.get_team_financial_director_projection(v_team_season.id)",
    );
    expect(migration).toContain(
      "private.get_team_financial_director_projection(p_team_season_id)",
    );
  });

  it("patches only projection variables, never cash or authorisation", () => {
    expect(migration).not.toMatch(/\b(?:update|insert into|delete from)\s+public\./iu);
    expect(migration).not.toMatch(/\binto\s+v_cash\s*;/iu);
    expect(migration).not.toMatch(/\bv_cash\s*:=/u);
    expect(migration).not.toMatch(/\b(?:grant|revoke)\s+(?:all|execute)/iu);
    expect(migration).toContain(
      "if v_cash<=0 or (not v_settings.allow_negative_projection and v_projection<=0) then return 0; end if;",
    );
  });

  it("fails closed on caller drift and is safely repeatable", () => {
    expect(migration).toContain("pg_catalog.pg_get_functiondef(v_patch.signature)");
    expect(migration).toContain("and position(v_anchor in v_definition) = 0");
    expect(migration).toContain("<> length(v_anchor)");
    expect(migration).toContain("raise exception 'Unexpected financial projection body");
    expect(migration).toContain("set local lock_timeout = '1s'");
    expect(migration).toContain("set local statement_timeout = '5s'");
  });

  it("has an isolated PostgreSQL regression harness for real-cash restrictions", () => {
    const harness = read("scripts/test-financial-director-purchase-projection-sql.mjs");
    expect(harness).toContain("new PGlite()");
    expect(harness).toContain("FINANCE_PROJECTION_FUNCTION_SNAPSHOT");
    expect(harness).toContain("await resetShop(35, -50, 1000)");
    expect(harness).toContain("await resetShop(0, -50, 1000)");
    expect(harness).toContain("await resetShop(-1, -50, 1000, true)");
    expect(harness).toContain("Due charges still cap today's available cash");
    expect(harness).toContain("productionFixtures: false");
  });
});
