import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260819120000_add_architect_parallel_construction.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("architect parallel construction migration", () => {
  it("reserves the random talent for architects of at least three stars", () => {
    expect(migration).toContain("'architect_parallel_construction'");
    expect(migration).toContain("v_member_level < 3");
    expect(migration).toContain("or v_member.level >= 3");
  });

  it("allows at most two active projects with the talented architect assigned", () => {
    expect(migration).toContain("v_active_count >= 2");
    expect(migration).toContain("v_existing_project_uses_talent");
    expect(migration).toContain("v_new_project_uses_talent");
    expect(migration).toContain("architect_contract_id = p_architect_contract_id");
    expect(migration).toContain("pg_advisory_xact_lock");
  });

  it("patches every active infrastructure dispatcher branch", () => {
    expect(migration).toContain("start_current_team_infrastructure_project");
    expect(migration).toContain(
      "start_current_team_infrastructure_project_legacy_20260812",
    );
    expect(migration).toContain(
      "start_current_team_infrastructure_project_legacy_20260811",
    );
    expect(migration).toContain(
      "assert_team_infrastructure_construction_slot(v_context.team_id",
    );
  });
});
