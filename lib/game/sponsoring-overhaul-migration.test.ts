import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260903140000_harden_sponsoring_renewals_and_jerseys.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("durcissement du sponsoring", () => {
  it("réserve un sponsor à une seule équipe et retire les anciennes offres", () => {
    expect(migration).toContain("generation_version < 5");
    expect(migration).toContain(
      "sponsor_offers_one_open_sponsor_per_season_idx",
    );
    expect(migration).toContain("prevent_sponsor_team_conflicts");
    expect(migration).toContain(
      "Ce sponsor est déjà représenté ou réservé par une autre équipe.",
    );
  });

  it("permet un nouveau maillot chaque saison sans changer de sponsor", () => {
    expect(migration).toContain("pending_jersey_season_id");
    expect(migration).toContain("select_next_season_sponsor_jersey");
    expect(migration).toContain("activate_pending_sponsor_jerseys");
  });

  it("finalise le budget de renouvellement à partir du calcul de J28", () => {
    expect(migration).toContain("finalize_planned_sponsor_renewal_budget");
    expect(migration).toContain("new.renewal_budget_adjustment_percent / 100");
    expect(migration).toContain("planned_start_season.game_year");
  });

  it("expose les trois décisions à l'assistant du DS", () => {
    expect(migration).toContain("get_current_sponsoring_alerts");
    expect(migration).toContain("signature_available boolean");
    expect(migration).toContain("renewal_available boolean");
    expect(migration).toContain("jersey_change_available boolean");
  });

  it("réutilise immédiatement les objectifs retournés par l'écriture", () => {
    const objectiveService = readFileSync(
      new URL("../../services/persisted-sponsor-objectives.ts", import.meta.url),
      "utf8",
    );

    expect(objectiveService).toContain("data: insertedRows");
    expect(objectiveService).toContain(".select(");
    expect(objectiveService).toContain(
      "existingObjectiveRows.push(...(insertedRows ?? []))",
    );
    expect(objectiveService).toContain("mergeObjectiveRows(");
  });
});
