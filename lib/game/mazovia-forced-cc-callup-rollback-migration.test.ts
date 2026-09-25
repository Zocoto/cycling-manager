import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260925124500_restore_mazovia_after_forced_cc_callups.sql",
  ),
  "utf8",
).toLowerCase();

describe("rollback des convocations CC forcées sur le Tour de Mazovie", () => {
  it("rétablit la protection permanente des tours déjà commencés", () => {
    expect(migration).toContain(
      "is_rider_protected_by_stage_race_for_international_selection",
    );
    expect(migration).toContain("unexpected international priority function");
    expect(migration).toContain("execute replace(v_definition");
  });

  it("annule seulement les confirmations automatiques de coureurs gérés", () => {
    expect(migration).toContain("selection_list.created_by_director_id is null");
    expect(migration).toContain("member.owner_director_id is not null");
    expect(migration).toContain("member.response_status = 'confirmed'");
    expect(migration).toContain(
      "member.responded_at = selection_list.published_at",
    );
    expect(migration).toContain(
      "set response_status = 'declined', responded_at = now()",
    );
  });

  it("resynchronise les CC puis réinscrit les seuls arrivants de l’étape 2", () => {
    expect(migration).toContain(
      "perform public.sync_national_federation_championship_lineup(",
    );
    expect(migration).toContain("race.slug = 'tour-de-mazovie'");
    expect(migration).toContain("stage_two.stage_number = 2");
    expect(migration).toContain("result.status = 'finished'");
    expect(migration).toContain("stage_three.stage_number = 3");
    expect(migration).toContain("set status = 'confirmed'");
  });
});
