import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260907163000_create_federal_school_cycling_plan.sql",
  ),
  "utf8",
);
const maintenanceRoute = readFileSync(
  resolve(process.cwd(), "app/api/cron/game-maintenance/route.ts"),
  "utf8",
);
const youthService = readFileSync(
  resolve(process.cwd(), "services/youth-development.ts"),
  "utf8",
);

describe("federal school cycling plan migration", () => {
  it("réserve le lancement au président en S3 avec les Académies N2", () => {
    expect(migration).toContain(
      "start_national_federation_school_cycling_plan",
    );
    expect(migration).toContain("v_season.game_year < 3");
    expect(migration).toContain("term.governance_mode = 'elected'");
    expect(migration).toContain(
      "term.president_director_id = v_identity.sporting_director_id",
    );
    expect(migration).toContain(
      "infrastructure.infrastructure_code = 'regional_academies'",
    );
    expect(migration).toContain("), 0) < 2");
    expect(migration).toContain("v_cost constant numeric := 1500000");
  });

  it("impose un unique plan courant et un redéploiement de 56 jours", () => {
    expect(migration).toContain(
      "national_federation_school_plan_one_current_idx",
    );
    expect(migration).toContain(
      "where status in ('deploying', 'active')",
    );
    expect(migration).toContain(
      "completes_game_day_index = starts_game_day_index + 56",
    );
    expect(migration).toContain("set status = 'superseded'");
    expect(migration).toContain("v_current_game_day + 56");
  });

  it("conserve les probabilités exactes de chaque rapport sans toucher au potentiel", () => {
    for (const column of [
      "historical_archetype",
      "school_plan_archetype",
      "school_plan_transfer_points",
      "archetype_probabilities",
    ]) {
      expect(migration).toContain(column);
      expect(youthService).toContain(column);
    }
    expect(youthService).toContain("getYouthArchetypeProbabilities");
    expect(youthService).toContain("generateYouthPotentialSteps");
  });

  it("active automatiquement les plans arrivés à échéance", () => {
    expect(migration).toContain(
      "settle_due_national_federation_school_plans",
    );
    expect(migration).toContain("transferPoints', 3");
    expect(maintenanceRoute).toContain(
      '"settle_due_national_federation_school_plans"',
    );
  });

  it("garde les écritures hors de portée directe des joueurs", () => {
    expect(migration).toMatch(
      /revoke all on function public\.settle_due_national_federation_school_plans\(\)\s+from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.start_national_federation_school_cycling_plan\(text, text\)\s+to authenticated, service_role/i,
    );
    expect(migration).toMatch(
      /grant all on table public\.national_federation_school_cycling_plans\s+to service_role/i,
    );
  });
});
