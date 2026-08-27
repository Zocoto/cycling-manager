import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { OFFICIAL_RACE_ENGINE_VERSION } from "./official-race-simulation";

const officialSimulationService = readFileSync(
  resolve(process.cwd(), "services/official-race-simulations.ts"),
  "utf8",
);
const officialSimulationMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260723170000_lock_official_stage_simulations.sql",
  ),
  "utf8",
);

describe("non-rétroactivité du moteur officiel", () => {
  it("attribue une nouvelle version uniquement aux prochaines simulations", () => {
    expect(OFFICIAL_RACE_ENGINE_VERSION).toBe(
      "2026.08-gc-protection-clock-v17",
    );
    expect(officialSimulationService).toContain(
      "engineVersion: OFFICIAL_RACE_ENGINE_VERSION",
    );
  });

  it("ne supprime, ne remplace et ne met jamais à jour une simulation verrouillée", () => {
    expect(officialSimulationService).toContain("if (!lockedSimulation)");
    expect(officialSimulationService).not.toMatch(
      /\.from\("official_stage_simulations"\)\s*\.(?:delete|update|upsert)\(/,
    );
    expect(officialSimulationService).not.toContain(
      "recalcul automatique",
    );
  });

  it("s'appuie sur l'unicité en base pour conserver le premier calcul officiel", () => {
    expect(officialSimulationMigration).toContain("stage_id uuid primary key");
    expect(officialSimulationMigration).toContain(
      "Scénario officiel immuable",
    );
    expect(officialSimulationService).toContain(
      'if (inserted.error?.code !== "23505")',
    );
    expect(officialSimulationService).toContain(
      'assertQuery(existing.error, "le scénario officiel verrouillé en parallèle")',
    );
  });
});
