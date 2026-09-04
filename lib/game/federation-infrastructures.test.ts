import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FEDERATION_INFRASTRUCTURE_CODES,
  FEDERATION_INFRASTRUCTURE_DEFINITIONS,
  MAX_FEDERATION_PROJECT_ARCHITECTS,
  calculateFederationConstructionPreview,
} from "@/lib/game/federation-infrastructures";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260903235500_create_federation_infrastructure_projects.sql",
  ),
  "utf8",
);
const programmeMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260904130000_expand_federation_program.sql",
  ),
  "utf8",
);

describe("federation infrastructures", () => {
  it("keeps the complete nine-building, five-level catalogue", () => {
    expect(FEDERATION_INFRASTRUCTURE_DEFINITIONS).toHaveLength(9);
    expect(new Set(FEDERATION_INFRASTRUCTURE_CODES)).toHaveProperty("size", 9);
    expect(
      FEDERATION_INFRASTRUCTURE_DEFINITIONS.every(
        (definition) => definition.levels.length === 5,
      ),
    ).toBe(true);
    expect(
      FEDERATION_INFRASTRUCTURE_DEFINITIONS.map(
        (definition) => definition.code,
      ),
    ).toEqual(FEDERATION_INFRASTRUCTURE_CODES);
  });

  it("caps architect contributions and never produces a negative quote", () => {
    const level = FEDERATION_INFRASTRUCTURE_DEFINITIONS[0].levels[4];
    const quote = calculateFederationConstructionPreview({
      level,
      architectCount: 99,
      priority: "cost",
    });

    expect(quote.architectCount).toBe(MAX_FEDERATION_PROJECT_ARCHITECTS);
    expect(quote.costReductionPercentage).toBe(20);
    expect(quote.cost).toBeGreaterThan(0);
    expect(quote.savedAmount).toBe(level.cost - quote.cost);
  });

  it("applies time and balanced priorities independently", () => {
    const level = FEDERATION_INFRASTRUCTURE_DEFINITIONS[2].levels[4];
    const fast = calculateFederationConstructionPreview({
      level,
      architectCount: 5,
      priority: "time",
    });
    const balanced = calculateFederationConstructionPreview({
      level,
      architectCount: 5,
      priority: "balanced",
    });

    expect(fast.cost).toBe(level.cost);
    expect(fast.durationReductionPercentage).toBe(30);
    expect(balanced.costReductionPercentage).toBe(10);
    expect(balanced.durationReductionPercentage).toBe(15);
  });

  it("persists S3 projects without permanently locking contributed architects", () => {
    expect(migration).toContain(
      "start_national_federation_infrastructure_project",
    );
    expect(migration).toContain(
      "contribute_architect_to_federation_project",
    );
    expect(migration).toContain(
      "settle_due_national_federation_infrastructure_projects",
    );
    expect(migration).toContain("if v_season.game_year < 3");
    expect(migration).toContain("v_architect_count >= 5");
    expect(migration).toContain("balance = balance + v_refund");
    expect(migration).not.toContain(
      "national_federation_architect_one_active_project_idx",
    );
  });

  it("uses federation-scale costs and releases dismissed architects", () => {
    expect(FEDERATION_INFRASTRUCTURE_DEFINITIONS[0].levels[0].cost).toBe(
      900_000,
    );
    expect(FEDERATION_INFRASTRUCTURE_DEFINITIONS[5].levels[4].durationDays).toBe(
      38,
    );
    expect(programmeMigration).toContain(
      "release_federation_architect_on_contract_end",
    );
    expect(programmeMigration).toContain(
      "update_national_federation_project_priority",
    );
    expect(programmeMigration).toContain(
      "recalculate_national_federation_project",
    );
  });
});
