import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260904001000_protect_in_progress_tours_from_international_selections.sql",
  ),
  "utf8",
).toLowerCase();
const finalizationMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260904002000_finalize_international_selection_repair.sql",
  ),
  "utf8",
).toLowerCase();
const campConflictMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260904004000_expose_international_selection_camp_conflicts.sql",
  ),
  "utf8",
).toLowerCase();

describe("protection des tours en cours contre les convocations", () => {
  it("conserve le coureur lorsqu’un tour chevauchant a déjà commencé", () => {
    expect(finalizationMigration).toContain(
      "create or replace function public.prioritize_international_championship_rider(",
    );
    expect(finalizationMigration).toContain(
      "is_rider_protected_by_stage_race_for_international_selection",
    );
    expect(finalizationMigration).toContain(
      "started_stage.departure_at <= p_at",
    );
    expect(finalizationMigration).toContain(
      "unfinished_stage.status <> 'completed'",
    );
    expect(finalizationMigration).toContain(
      "other_edition.withdrawal_closes_at <= p_at",
    );
    expect(finalizationMigration).toContain("then\n    return;");
  });

  it("écarte le coureur avant que la convocation soit envoyée", () => {
    expect(migration).toContain(
      "create trigger exclude_locked_stage_race_rider_from_international_selection",
    );
    expect(migration).toContain("new.response_status := 'unavailable'");
    expect(migration).toContain("new.is_selected := false");
  });

  it("ne crée aucune start-list et ne retire aucune course avant la réponse", () => {
    expect(migration).toContain(
      "if v_candidate.response_status = 'pending' then",
    );
    expect(migration).toContain("continue;");
    expect(migration).toContain("candidate.response_status = 'pending'");
    expect(finalizationMigration).toContain(
      "candidate.response_status = 'pending'",
    );
    expect(finalizationMigration).toContain(
      "has_rider_calendar_conflict_for_international_selection",
    );
  });

  it("expose les courses réellement sacrifiées dans la convocation", () => {
    const selectionService = readFileSync(
      join(process.cwd(), "services/international-championship-selections.ts"),
      "utf8",
    );
    const selectionPage = readFileSync(
      join(process.cwd(), "app/jeu/selections-internationales/page.tsx"),
      "utf8",
    );

    expect(migration).toContain("conflicting_race_names text[]");
    expect(selectionService).toContain("conflictingRaceNames");
    expect(selectionPage).toContain(
      "Si vous acceptez la convocation, votre coureur sera",
    );
    expect(selectionPage).toContain("désinscrit de la course");
    expect(migration).toContain(
      "si vous acceptez la convocation, votre coureur sera désinscrit de la course",
    );
  });

  it("expose aussi les stages et préparations qui seront annulés", () => {
    const selectionService = readFileSync(
      join(process.cwd(), "services/international-championship-selections.ts"),
      "utf8",
    );
    const selectionPage = readFileSync(
      join(process.cwd(), "app/jeu/selections-internationales/page.tsx"),
      "utf8",
    );

    expect(campConflictMigration).toContain("conflicting_camp_names text[]");
    expect(campConflictMigration).toContain("stage de reconnaissance");
    expect(campConflictMigration).toContain("stage de forme classique");
    expect(campConflictMigration).toContain("stage de forme premium");
    expect(campConflictMigration).toContain(
      "camp.status in ('planned', 'active')",
    );
    expect(campConflictMigration).toContain(
      "camp.start_day_number <= target_range.end_day_number",
    );
    expect(campConflictMigration).toContain(
      "camp.end_day_number >= target_range.start_day_number",
    );
    expect(campConflictMigration).toContain(
      "perform public.sync_director_international_selection_message",
    );
    expect(campConflictMigration).toContain(
      "or cardinality(\n      public.get_rider_international_selection_conflicting_camp_names",
    );
    expect(campConflictMigration).toContain(
      "v_current_day_number < v_camp.start_day_number",
    );
    expect(campConflictMigration).toContain(
      "v_candidate_response_status = 'confirmed'",
    );
    expect(campConflictMigration).toContain(
      "international-selection-camp-refund:",
    );
    expect(campConflictMigration).toContain(
      "on conflict (team_season_id, source_reference) do nothing",
    );
    expect(campConflictMigration).toContain(
      "set cash_balance = team_season.cash_balance + v_camp.refund_amount",
    );
    expect(selectionService).toContain("conflictingCampNames");
    expect(selectionPage).toContain("selection.conflictingCampNames");
    expect(selectionPage).toContain("activités programmées suivantes");
    expect(selectionPage).toContain("qui n’a pas encore commencé sera");
  });

  it("restaure 164 coureurs et préserve le retrait médical antérieur", () => {
    expect(migration).toContain(
      "create table public.international_selection_stage_race_repairs",
    );
    expect(migration).toContain("if v_detected_count <> 165 then");
    expect(migration).toContain("if v_excluded_count <> 1 then");
    expect(migration).toContain("if v_repaired_count <> 164 then");
    expect(migration).toContain("stage_rider_unavailabilities");
    expect(migration).toContain("set status = 'confirmed'");
  });

  it("ne libère les convocations qu’après les resimulations et 30 cadeaux", () => {
    expect(finalizationMigration).toContain(
      "simulation.created_at < repair.repaired_at",
    );
    expect(finalizationMigration).toContain(
      "la finalisation attend 11 étapes resimulées et complètes",
    );
    expect(finalizationMigration).toContain(
      "catalog.importance = 8",
    );
    expect(finalizationMigration).toContain(
      "la réparation attend 30 cadeaux",
    );
    expect(finalizationMigration).toContain("set released_at = now()");
  });
});
