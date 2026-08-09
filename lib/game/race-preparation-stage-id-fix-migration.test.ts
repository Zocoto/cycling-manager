import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const initialMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260808164000_create_race_preparations.sql",
  ),
  "utf8",
);
const fixMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260809100000_fix_race_preparation_stage_id_conflict.sql",
  ),
  "utf8",
);

describe("race preparation stage id conflict fix", () => {
  it("uses the named primary-key constraint in fresh databases", () => {
    expect(initialMigration).toContain(
      "on conflict on constraint race_stage_strategies_pkey",
    );
    expect(initialMigration).not.toContain(
      "on conflict (race_registration_id, stage_id)",
    );
  });

  it("repairs the already-deployed function without touching preparation data", () => {
    expect(fixMigration).toContain("pg_get_functiondef");
    expect(fixMigration).toContain(
      "'on conflict (race_registration_id, stage_id)'",
    );
    expect(fixMigration).toContain(
      "'on conflict on constraint race_stage_strategies_pkey'",
    );
    expect(fixMigration).toContain("execute replace(");
    expect(fixMigration).not.toMatch(
      /delete\s+from\s+public\.race_stage_strategies/i,
    );
  });

  it("is idempotent when the function is already corrected", () => {
    expect(fixMigration).toContain(
      "elsif position(v_constraint_clause in v_function_definition) = 0",
    );
  });
});
