import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260729103000_prevent_retroactive_training_sessions.sql",
  ),
  "utf8",
);

const consumers = [
  "services/team-training.ts",
  "services/dashboard-events.ts",
  "services/rider-progression.ts",
].map((path) => readFileSync(join(process.cwd(), path), "utf8"));

describe("training contract eligibility migration", () => {
  it("compare la signature au passage effectif de 8 h", () => {
    expect(migration).toContain(
      "coalesce(contract.signed_at, contract.created_at)",
    );
    expect(migration).toContain(
      "day.calendar_date::timestamp + time '08:00'",
    );
    expect(migration).toContain(
      "public.is_rider_contract_training_eligible(contract.id, v_day.id)",
    );
  });

  it("marque les anciennes lignes rétroactives sans les effacer", () => {
    expect(migration).toContain(
      "add column if not exists is_contract_eligible boolean",
    );
    expect(migration).toContain(
      "set is_contract_eligible = exists",
    );
  });

  it("exclut les lignes invalides des deux métriques d’objectifs", () => {
    expect(migration).toContain(
      "v_marker constant text := 'where session.status = ''completed'''",
    );
    expect(migration).toContain("if v_marker_count <> 2 then");
    expect(migration).toContain(
      "and session.is_contract_eligible",
    );
  });

  it("retire les lignes rétroactives de toutes les consultations", () => {
    for (const source of consumers) {
      expect(source).toContain('.eq("is_contract_eligible", true)');
    }
  });
});