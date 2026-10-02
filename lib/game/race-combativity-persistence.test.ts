import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const serviceSource = readFileSync(
  join(process.cwd(), "services", "race-results.ts"),
  "utf8",
);
const migrationSource = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261002220000_create_race_combativity_awards.sql",
  ),
  "utf8",
);

describe("combativity persistence", () => {
  it("fige un unique lauréat par étape et un unique super-combatif par tour", () => {
    expect(migrationSource).toContain(
      "race_combativity_awards_stage_unique_idx",
    );
    expect(migrationSource).toContain(
      "race_combativity_awards_race_unique_idx",
    );
    expect(migrationSource).toContain("score_breakdown jsonb");
  });

  it("crédite des récompenses idempotentes sans points UCI", () => {
    expect(serviceSource).toContain("official-combativity:");
    expect(serviceSource).toContain("p_uci_points: 0");
    expect(serviceSource).toContain("p_is_victory: false");
    expect(serviceSource).toContain('onConflict: "award_key"');
  });
});
