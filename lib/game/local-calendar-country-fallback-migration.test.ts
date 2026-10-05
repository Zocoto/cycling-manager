import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const migration = readFileSync("supabase/migrations/20261005200000_fix_local_calendar_country_fallback.sql", "utf8");
describe("local-calendar sponsor-page source fix", () => {
  it("fixes the country fallback's field names without rewriting other calendar logic", () => {
    expect(migration).toContain("'private.ensure_local_race_calendar_for_country(uuid,uuid)'::regprocedure");
    expect(migration).toContain("'v_catalog record;'");
    expect(migration).toContain("'v_catalog private.local_race_country_catalog%rowtype;'");
    expect(migration).toContain("execute v_definition;");
    expect(migration).not.toMatch(/(?:insert into|update public|delete from)/i);
  });
  it("bounds production lock/query waits and rejects unexpected source drift", () => {
    expect(migration).toContain("set local lock_timeout = '3s'");
    expect(migration).toContain("set local statement_timeout = '15s'");
    expect(migration).toContain("migration aborted");
    expect(migration).toContain("return;");
  });
});
