import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve(process.cwd(), "supabase/migrations");
const fixMigrationName =
  "20260915100000_permanently_fix_optional_infrastructure_architect.sql";
const fixMigration = readFileSync(
  resolve(migrationsDirectory, fixMigrationName),
  "utf8",
).replace(/\r\n/g, "\n");

describe("permanent optional infrastructure architect guard", () => {
  it("removes the unassigned polymorphic record from the active RPC", () => {
    expect(fixMigration).toContain("v_architect_id uuid;");
    expect(fixMigration).toContain("v_architect_level integer;");
    expect(fixMigration).toContain(
      "into v_architect_id, v_architect_level, v_architect_specialty",
    );
    expect(fixMigration).toContain("if v_architect_id is null then");
    expect(fixMigration).toContain(
      "'v_architect.level',\n    'v_architect_level'",
    );
  });

  it("verifies the repaired function during deployment", () => {
    expect(fixMigration).toContain("Deployment-time postcondition");
    expect(fixMigration).toContain(
      "Optional architect postcondition failed; infrastructure RPC was not repaired.",
    );
    expect(fixMigration).toContain("position('v_architect record;' in v_definition) > 0");
    expect(fixMigration).toContain("position('v_architect.' in v_definition) > 0");
  });

  it("rejects future full RPC definitions that restore an anonymous architect record", () => {
    const laterMigrations = readdirSync(migrationsDirectory)
      .filter((name) => name.endsWith(".sql") && name > fixMigrationName)
      .map((name) => ({
        name,
        sql: readFileSync(resolve(migrationsDirectory, name), "utf8").replace(
          /\r\n/g,
          "\n",
        ),
      }));

    for (const migration of laterMigrations) {
      const redefinesConstructionRpc = migration.sql.includes(
        "create or replace function public.start_current_team_infrastructure_project(",
      );
      expect(
        redefinesConstructionRpc && migration.sql.includes("v_architect record;"),
        `${migration.name} must keep architect state in nullable scalar variables`,
      ).toBe(false);
    }
  });
});
