import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260814010000_initialize_optional_infrastructure_architect.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const projectFunctions = [
  "start_current_team_infrastructure_project",
  "start_current_team_infrastructure_project_legacy_20260812",
  "start_current_team_infrastructure_project_legacy_20260811",
] as const;

describe("optional infrastructure architect migration", () => {
  it("patches every function in the active infrastructure dispatch chain", () => {
    for (const functionName of projectFunctions) {
      expect(migration).toContain(`'${functionName}'`);
    }
    expect(migration).toContain("foreach v_function_name in array");
    expect(migration).toContain("execute v_patched_definition");
  });

  it("gives the optional architect record a nullable shape", () => {
    expect(migration).toContain("null::uuid as id");
    expect(migration).toContain("null::integer as level");
    expect(migration).toContain("null::text as architect_specialty");
    expect(migration).toContain("null::text as specialty");
    expect(migration).toContain("into v_architect");
  });
    expect(migration).toContain("v_crlf_anchor");
    expect(migration).toContain("v_crlf_replacement");

  it("is idempotent and fails safely if a function changes shape", () => {
    expect(migration).toContain(
      "position('Initialize the optional architect record' in v_definition) > 0",
    );
    expect(migration).toContain(
      "Infrastructure function % has an unexpected definition.",
    );
    expect(migration).toContain(
      "Infrastructure function % is missing.",
    );
  });
});
