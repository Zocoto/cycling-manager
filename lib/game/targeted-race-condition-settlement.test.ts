import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("targeted race condition settlement", () => {
  it("limits condition updates to the stage currently being homologated", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260904014000_target_race_condition_settlement.sql",
      ),
      "utf8",
    );
    const service = readFileSync(
      resolve(process.cwd(), "services/race-results.ts"),
      "utf8",
    );

    expect(migration).toContain("cyclostratege.condition_stage_id");
    expect(migration).toContain("settle_finished_stage_conditions");
    expect(migration).toContain("set statement_timeout = '60s'");
    expect(service).toContain('"settle_finished_stage_conditions"');
    expect(service).toContain("{ p_stage_id: stage.id }");
  });
});
