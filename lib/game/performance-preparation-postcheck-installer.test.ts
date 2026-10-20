import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "scripts/apply-reviewed-preparation-postcheck-migrations.mjs"), "utf8");

describe("reviewed preparation postcheck installer safety", () => {
  it("requires the exact explicit mode and project before invoking the CLI", () => {
    expect(source).toContain('process.argv.length !== 3 || process.argv[2] !== "--apply-reviewed-fix"');
    expect(source).toContain('readFileSync("supabase/.temp/project-ref", "utf8").trim() !== "ikagfuchasnsakpouosg"');
    expect(source.indexOf('process.argv.length !== 3')).toBeLessThan(source.indexOf('const binary ='));
    expect([...source.matchAll(/version: "(\d+)"/g)].map((match) => match[1])).toEqual(["20261020120500", "20261020121000"]);
    expect(source).not.toContain('"push"');
    expect(source).not.toMatch(/dotenv|process\.env|writeFile|createSupabase/);
  });

  it("verifies exact booking/cancellation bodies and both context overloads without defaults", () => {
    for (const marker of [
      "expectedBookingHash", "expectedCancellationHash", "expectedWrapperHash", "expectedCoreHash",
      "cancellation_trigger", "cancellation_index", "cancellation_acl", "booking_acl",
      "pronargdefaults=0", "pronargs in(1,3)", "context_acl_and_arguments", "state.legacy_result === state.core_result",
      "preparation.bonus_end_game_day >= coalesce(p_min_game_day, -2147483648)",
      "preparation.bonus_start_game_day <= coalesce(p_max_game_day, 2147483647)",
      "bonus_end_game_day", "bonus_start_game_day", "indisvalid and indisready",
    ]) expect(source).toContain(marker);
    expect(source).toContain("has_function_privilege('service_role',oid,'execute')");
    expect(source).toContain("not has_function_privilege('authenticated',oid,'execute')");
  });

  it("checks installation before writing only its bounded migration receipts", () => {
    expect(source).toContain("if (recorded(before) && !installed(before))");
    expect(source.indexOf("if (!installed(applied)")).toBeLessThan(source.indexOf("insert into supabase_migrations.schema_migrations"));
    expect(source).toContain("after.settlement_hash !== baseline.settlement_hash");
    expect(source).toContain("after.architect_hash !== baseline.architect_hash");
    expect(source).toContain("set local lock_timeout='3s'; set local statement_timeout='5s'");
    expect(source).not.toMatch(/select\s+public\.(settle|simulate|start_)/i);
    expect(source).not.toMatch(/update\s+public\./i);
  });

  it("bounds diagnostics and checks only its exact two application names after a disconnect", () => {
    expect(source).toContain("set local statement_timeout='4s'; set local lock_timeout='500ms'");
    expect(source).toContain("timeout: 30_000");
    expect(source).toContain("taskOwnedTransactionsRemaining");
    expect(source).toContain("where application_name in(${migrations.map");
    expect(source).toContain("and pid<>pg_backend_pid() and (state='active' or xact_start is not null)");
    expect(source).not.toMatch(/pg_(cancel|terminate)_backend/);
    expect(source).toContain("stop and inspect connectivity");
  });
});
